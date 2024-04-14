import { type } from "arktype";
import { $any, storageLoader, storageSaver } from "../helpers/durable.js";
import {
  type Credential,
  parseAuthenticationEncoded,
  parsedBoolean,
  type Visitor,
  type VisitorHeaders,
  parseVisitorHeaders,
  parseRegistrationEncoded,
} from "../helpers/parser.js";
import { now } from "../helpers/time.js";
import { server } from "@passwordless-id/webauthn";
import { type ServerAppName } from "../plugins/server.js";
import {
  type PluginContext,
  err,
  type Plugin,
  Router,
  ok,
  empty,
} from "@mewhhaha/little-worker";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { encode } from "@mewhhaha/little-worker/crypto";

const parseMetadata = type({
  passkeyId: "string",
  credentialId: "string",
  userId: "string",
  app: "string",
  createdAt: "string",
});

const inferredMetadata = parseMetadata.infer;
/** @public */
export type Metadata = typeof inferredMetadata;

export type Passkey = {
  credential: Credential;
  metadata: Metadata;
};

// This should be `passkey:${app}:${userId}`
export type GuardPasskey = `passkey:${ServerAppName}:${string}`;

export const guardPasskey = (
  app: ServerAppName,
  userId: DurableObjectId | string
) => {
  return `passkey:${app}:${userId.toString()}` as const;
};

const unoccupied_ = ((_: PluginContext<any>, self) => {
  if (self.metadata !== undefined) {
    return err(409, { message: "passkey_exists" });
  }

  return {};
}) satisfies Plugin<[DurableObjectPasskey]>;

const occupied_ = ((
  {
    request,
  }: PluginContext<{
    init: { headers: { Authorization: GuardPasskey } };
  }>,
  self
) => {
  const authorization = request.headers.get("Authorization");
  if (authorization === null) {
    return err(401, { message: "authorization_missing" });
  }

  if (self.metadata === undefined || self.credential === undefined) {
    return err(404, { message: "passkey_missing" });
  }

  // First word is just passkey:
  const [, app, userId] = authorization.split(":");

  if (app !== self.metadata.app) {
    return err(403, { message: "app_mismatch" });
  }

  if (userId !== self.metadata.userId) {
    return err(403, { message: "user_mismatch" });
  }

  return { metadata: self.metadata, credential: self.credential } as const;
}) satisfies Plugin<[DurableObjectPasskey]>;

export class DurableObjectPasskey implements DurableObject {
  metadata?: Metadata;
  credential?: Credential;
  counter: number = -1;

  private readonly id: DurableObjectId;

  visitors: Visitor[] = [];

  storage: DurableObjectStorage;

  private readonly save = storageSaver<DurableObjectPasskey>(this);
  private readonly load = storageLoader<DurableObjectPasskey>(this);

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
    this.id = state.id;

    void state.blockConcurrencyWhile(async () => {
      await this.load("metadata", "credential", "visitors", "counter");
    });
  }

  static router = Router<[DurableObjectPasskey]>()
    .post(
      "/start-register",
      [
        unoccupied_,
        data_(
          type({
            app: "string",
            userId: "string",
            registration: parseRegistrationEncoded,
            challengeId: "string",
            origin: "string",
            visitor: parseVisitorHeaders,
          })
        ),
      ],
      async (
        { data: { registration, userId, app, challengeId, origin, visitor } },
        object
      ) => {
        try {
          const { authenticator, credential } = await server.verifyRegistration(
            registration,
            {
              challenge: encode(challengeId),
              origin,
            }
          );

          const metadata: Metadata = {
            userId,
            app,
            passkeyId: object.id.toString(),
            credentialId: credential.id,

            createdAt: now(),
          };

          object.save("credential", credential);
          object.save("metadata", metadata);

          const visitors = [makeVisitor(visitor, authenticator.aaguid)];

          object.save("visitors", visitors);

          const tenMinutesFromNow = new Date(Date.now() + 1000 * 60 * 10);
          void object.storage.setAlarm(tenMinutesFromNow);

          return ok(201, { metadata });
        } catch (e) {
          return err(403, { message: "registration_failed" });
        }
      }
    )
    .post("/finish-register", [occupied_], (_, object) => {
      void object.storage.deleteAlarm();
      return empty(204);
    })
    .post(
      "/authenticate",
      [
        data_(
          type({
            app: "string",
            challengeId: "string",
            origin: "string",
            authentication: parseAuthenticationEncoded,
            visitor: parseVisitorHeaders,
          })
        ),
      ],
      async (
        { data: { app, authentication, visitor, challengeId, origin } },
        object
      ) => {
        if (
          object.credential === undefined ||
          object.metadata === undefined ||
          app !== object.metadata.app
        ) {
          return err(404, "passkey_missing");
        }

        try {
          const { authenticator } = await server.verifyAuthentication(
            authentication,
            object.credential,
            {
              origin,
              challenge: encode(challengeId),
              counter: object.counter,
              userVerified: true,
            }
          );

          const counter = authenticator.counter;
          object.save("counter", counter === 0 ? -1 : counter);

          const visitors = [
            makeVisitor(visitor, authenticator.aaguid),
            ...object.visitors,
          ].slice(0, 10);
          object.save("visitors", visitors);

          return ok(200, { metadata: object.metadata });
        } catch (e) {
          if (e instanceof Error) console.log(e);
          return err(403, "authentication_failed");
        }
      }
    )
    .get(
      "/data",
      [
        occupied_,
        query_(
          type({ "credential?": parsedBoolean, "visitors?": parsedBoolean })
        ),
      ],
      async (
        { metadata, query: { credential = false, visitors = false } },
        object
      ) => {
        const data: {
          metadata: Metadata;
          credential?: Credential;
          visitors?: Visitor[];
        } = {
          metadata,
        };

        if (credential) {
          data.credential = object.credential;
        }

        if (visitors) {
          data.visitors = object.visitors;
        }

        return ok(200, data);
      }
    )
    .delete("/implode", [occupied_], async ({ metadata }, object) => {
      object.implode();
      return ok(200, { metadata });
    })
    .all("/*", [], () => {
      return new Response("Not found", { status: 404 });
    });

  implode() {
    void this.storage.deleteAll();

    this.metadata = undefined;
    this.credential = undefined;
    this.visitors = [];
    this.counter = -1;
  }

  alarm() {
    this.implode();
  }

  fetch(
    request: Request<unknown, CfProperties<unknown>>
  ): Response | Promise<Response> {
    return DurableObjectPasskey.router.handle(request, this);
  }
}

export const $passkey = $any<typeof DurableObjectPasskey, Env["DO_PASSKEY"]>;

export const makeVisitorHeaders = (request: Request): VisitorHeaders => {
  return {
    city: request.headers.get("cf-ipcity") ?? undefined,
    country: request.headers.get("cf-ipcountry") ?? undefined,
    continent: request.headers.get("cf-ipcontinent") ?? undefined,
    longitude: request.headers.get("cf-iplongitude") ?? undefined,
    latitude: request.headers.get("cf-iplatitude") ?? undefined,
    region: request.headers.get("cf-region") ?? undefined,
    regionCode: request.headers.get("cf-region-code") ?? undefined,
    metroCode: request.headers.get("cf-metro-code") ?? undefined,
    postalCode: request.headers.get("cf-postal-code") ?? undefined,
    timezone: request.headers.get("cf-timezone") ?? undefined,
  };
};

const makeVisitor = (
  headers: VisitorHeaders,
  authenticator: string
): Visitor => {
  return {
    ...headers,
    timestamp: now(),
    authenticator,
  };
};
