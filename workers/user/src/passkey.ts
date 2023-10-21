import { Plugin, PluginContext, Router } from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { empty, error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { $any, storageLoader, storageSaver } from "./helpers/durable";
import { Credential, parseCredential, parsedBoolean } from "./helpers/parser";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { now } from "./helpers/time";

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
  userId: "string",
  app: "string",
  createdAt: "string",
});

export type Metadata = typeof parseMetadata.infer;

export type Visitor = typeof parseVisitor.infer;

export type Passkey = { credential: Credential; metadata: Metadata };

// This should be `passkey:${app}:${userId}`
export type GuardPasskey = `passkey:${string}:${string}`;

const occupied_ = ((
  {
    request,
  }: PluginContext<{
    init: { headers: { Authorization: GuardPasskey } };
  }>,
  self
) => {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return error(401, "authorization_missing");
  }

  if (!self.metadata || !self.credential) {
    return error(404, "passkey_missing");
  }

  const [_, app, userId] = authorization.split(":");

  if (app !== self.metadata.app) {
    return error(403, "app_mismatch");
  }

  if (userId !== self.metadata.userId) {
    return error(403, "user_mismatch");
  }

  return { metadata: self.metadata, credential: self.credential } as const;
}) satisfies Plugin<[DurableObjectPasskey]>;

export class DurableObjectPasskey implements DurableObject {
  metadata?: Metadata;
  credential?: Credential;
  counter: number = -1;

  private id: DurableObjectId;

  visitors: Visitor[] = [];

  storage: DurableObjectStorage;

  private save = storageSaver<DurableObjectPasskey>(this);
  private load = storageLoader<DurableObjectPasskey>(this);

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
    this.id = state.id;

    state.blockConcurrencyWhile(async () => {
      await this.load("metadata", "credential", "visitors", "counter");
    });
  }

  occupy(data: {
    credential: Credential;
    userId: string;
    app: string;
    visitor: Visitor;
  }) {
    const metadata: Metadata = {
      userId: data.userId,
      app: data.app,
      passkeyId: this.id.toString(),
      credentialId: data.credential.id,

      createdAt: now(),
    };
    this.save("metadata", metadata);
    this.save("credential", data.credential);
    this.save("visitors", [data.visitor]);

    return { metadata, credential: data.credential };
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
        const { credential, metadata } = self.occupy(data);

        return ok(201, { credential, metadata });
      }
    )
    .put(
      "/visit",
      [occupied_, data_(type({ visitor: parseVisitor, counter: "number" }))],
      async ({ data: { counter, visitor } }, self) => {
        self.save("counter", counter || -1);
        self.save("visitors", [visitor, ...self.visitors].slice(0, 10));
        return empty(204);
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
      async ({ metadata, query }, self) => {
        const data: {
          metadata: Metadata;
          credential?: Credential;
          visitors?: Visitor[];
        } = {
          metadata,
        };

        if (query.credential) {
          data.credential = self.credential;
        }

        if (query.visitors) {
          data.visitors = self.visitors;
        }

        return ok(200, data);
      }
    )
    .delete("/implode", [occupied_], async ({ metadata }, self) => {
      self.storage.deleteAll();

      self.metadata = undefined;
      self.credential = undefined;

      return ok(200, { metadata });
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
