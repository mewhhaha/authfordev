import { Plugin, PluginContext, Router } from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { empty, error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { $any, storageLoader, storageSaver } from "./helpers/durable";
import {
  Credential,
  parseAuthenticationEncoded,
  parseCredential,
  parsedBoolean,
} from "./helpers/parser";
import { Env } from "./helpers/env";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { now } from "./helpers/time";
import { server } from "@passwordless-id/webauthn";
import { encode } from "@internal/jwt";

const parseVisitor = type({
  "city?": "string",
  "country?": "string",
  "continent?": "string",
  "longitude?": "string",
  "latitude?": "string",
  "region?": "string",
  "regionCode?": "string",
  "metroCode?": "string",
  "postalCode?": "string",
  "timezone?": "string",
  timestamp: "string",
});

const parseMetadata = type({
  passkeyId: "string",
  credentialId: "string",
  name: "string",
  userId: "string",
  app: "string",
  createdAt: "string",
  lastUsedAt: "string",
  counter: "number",
});

export type Metadata = typeof parseMetadata.infer;

export type Visitor = typeof parseVisitor.infer;

export type Passkey = { credential: Credential; metadata: Metadata };

const user_ = ((
  {
    request,
  }: PluginContext<{
    init: { headers: { Authorization: `${string}:${string}` } };
  }>,
  self
) => {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return error(401, "authorization_missing");
  }

  if (!self.metadata || !self.credential) {
    return error(404, "passkey_unoccupied");
  }

  const [app, userId] = authorization.split(":");

  if (app !== self.metadata.app) {
    return error(403, "app_mismatch");
  }

  if (userId !== self.metadata.userId) {
    return error(403, "app_mismatch");
  }

  return { metadata: self.metadata, credential: self.credential } as const;
}) satisfies Plugin<[DurableObjectPasskey]>;

const app_ = ((
  {
    request,
  }: PluginContext<{
    init: { headers: { Authorization: `${string}` } };
  }>,
  self
) => {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return error(401, "authorization_missing");
  }

  if (!self.metadata || !self.credential) {
    return error(404, "passkey_unoccupied");
  }

  if (authorization !== self.metadata.app) {
    return error(403, "app_mismatch");
  }

  return { metadata: self.metadata, credential: self.credential } as const;
}) satisfies Plugin<[DurableObjectPasskey]>;

export class DurableObjectPasskey implements DurableObject {
  metadata?: Metadata;
  credential?: Credential;

  private id: DurableObjectId;

  visitors: Visitor[] = [];

  storage: DurableObjectStorage;

  private save = storageSaver<DurableObjectPasskey>(this);
  private load = storageLoader<DurableObjectPasskey>(this);

  constructor(state: DurableObjectState, env: Env) {
    this.storage = state.storage;
    this.id = state.id;

    state.blockConcurrencyWhile(async () => {
      await this.load("metadata", "credential", "visitors");
    });
  }

  occupy(data: {
    credential: Credential;
    userId: string;
    app: string;
    visitor: Visitor;
  }) {
    const meta = {
      userId: data.userId,
      app: data.app,
      passkeyId: this.id.toString(),
      name: `passkey-${data.credential.id}`,
      credentialId: data.credential.id,
      counter: -1,

      createdAt: now(),
      lastUsedAt: now(),

      visitors: [data.visitor],
    };
    this.save("metadata", meta);
    this.save("credential", data.credential);
    this.save("visitors", [data.visitor]);

    return { meta, credential: data.credential };
  }

  static router = Router<[DurableObjectPasskey]>()
    .post(
      "/occupy",
      [
        data_(
          type({
            app: "string",
            userId: "string",
            credential: parseCredential,
            visitor: parseVisitor,
          })
        ),
      ],
      async ({ data }, self) => {
        if (self.metadata) {
          return error(403, "credential_exists");
        }
        const { credential, meta } = self.occupy(data);

        return ok(201, { credential, meta });
      }
    )
    .put(
      "/rename",
      [user_, data_(type({ name: "string" }))],
      async ({ metadata: meta, data }, self) => {
        const updated = {
          ...meta,
          name: data.name,
        };
        self.save("metadata", updated);
        return empty(204);
      }
    )
    .put(
      "/visit",
      [user_, data_(type({ visitor: parseVisitor, counter: "number" }))],
      async ({ metadata, data: { counter, visitor } }, self) => {
        const updated = {
          ...metadata,
          counter: counter || -1,
          lastUsedAt: now(),
        };
        self.save("metadata", updated);
        self.save("visitors", [visitor, ...self.visitors].slice(0, 10));
        return empty(204);
      }
    )
    .post(
      "/authenticate",
      [
        app_,
        data_(
          type({
            authentication: parseAuthenticationEncoded,
            origin: "string",
            challenge: "string",
          })
        ),
      ],
      async ({
        metadata,
        credential,
        data: { authentication, origin, challenge },
      }) => {
        try {
          const { authenticator } = await server.verifyAuthentication(
            authentication,
            credential,
            {
              origin,
              challenge: encode(challenge),
              counter: metadata.counter,
              userVerified: true,
            }
          );

          return ok(200, {
            userId: metadata.userId,
            counter: authenticator.counter,
          });
        } catch (err) {
          console.error(err);
          return error(403, { message: "authentication_failed" });
        }
      }
    )
    .get(
      "/data",
      [user_, query_(type({ "credential?": parsedBoolean }))],
      async ({ metadata, query }, self) => {
        const data: { metadata: Metadata; credential?: Credential } = {
          metadata,
        };

        if (query.credential) {
          data.credential = self.credential;
        }
        return ok(200, data);
      }
    )
    .get("/visitors", [user_], async (_, self) => {
      return ok(200, {
        visitors: self.visitors,
      });
    })
    .delete("/implode", [user_], async ({ metadata: meta }, self) => {
      self.storage.deleteAll();

      self.metadata = undefined;
      self.credential = undefined;

      return ok(200, { meta });
    })
    .all("/*", [], () => {
      return new Response("Not found", { status: 404 });
    });

  fetch(
    request: Request<unknown, CfProperties<unknown>>
  ): Response | Promise<Response> {
    return DurableObjectPasskey.router.handle(request, this);
  }
}

export const $passkey = $any<typeof DurableObjectPasskey>;

export const makeVisitor = (request: Request) => {
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
    timestamp: now(),
  };
};
