import { Plugin, PluginContext, Router } from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { empty, error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { $any, storageLoader, storageSaver } from "./helpers/durable";
import { Credential, parseCredential, parsedBoolean } from "./helpers/parser";
import { Env } from "./helpers/env";
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

const occupied_ = ((
  {
    request,
  }: PluginContext<{
    init: { headers: { Authorization: string } };
  }>,
  self
) => {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return error(401, "authorization_missing");
  }

  if (!self.metadata) {
    return error(404, "passkey_unoccupied");
  }

  if (authorization !== self.metadata?.app) {
    return error(403, "app_mismatch");
  }

  return { metadata: self.metadata } as const;
}) satisfies Plugin<[DurableObjectPasskey]>;

export class DurableObjectPasskey implements DurableObject {
  metadata?: Metadata;
  credential?: Credential;

  private kv: KVNamespace;
  private id: DurableObjectId;

  visitors: Visitor[] = [];

  storage: DurableObjectStorage;

  private save = storageSaver<DurableObjectPasskey>(this);
  private load = storageLoader<DurableObjectPasskey>(this);

  constructor(state: DurableObjectState, env: Env) {
    this.storage = state.storage;
    this.kv = env.KV_PASSKEY;
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

  cache() {
    if (!this.metadata || !this.credential) {
      throw new Error("Cannot cache empty passkey");
    }

    this.kv.put(
      cacheKeySinglePasskey(this.metadata),
      JSON.stringify<Passkey>({
        credential: this.credential,
        metadata: this.metadata,
      }),
      {
        metadata: this.metadata,
      }
    );
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
        self.cache();

        return ok(201, { credential, meta });
      }
    )

    .post(
      "/used",
      [occupied_, data_(type({ counter: "number", visitor: parseVisitor }))],
      async ({ metadata: meta, data }, self) => {
        const updated = {
          ...meta,
          lastUsedAt: data.visitor.timestamp,
          counter: data.counter || -1,
        };
        self.save("metadata", updated);
        // We only save the ten last visitors
        self.save("visitors", [data.visitor, ...self.visitors].slice(0, 10));
        self.cache();
        return empty(204);
      }
    )
    .post(
      "/rename",
      [occupied_, data_(type({ name: "string" }))],
      async ({ metadata: meta, data }, self) => {
        const updated = {
          ...meta,
          name: data.name,
        };
        self.save("metadata", updated);
        self.cache();
        return empty(204);
      }
    )
    .get(
      "/data",
      [occupied_, query_(type({ "credential?": parsedBoolean }))],
      async ({ metadata, query }, self) => {
        const data: { metadata: Metadata; credential?: Credential } = {
          metadata,
        };

        if (query.credential) {
          data.credential = self.credential;
        }
        return ok(200, { metadata });
      }
    )
    .get(
      "/visitors",
      [occupied_, query_(type({ "metadata?": "'true'" }))],
      async ({ query, metadata }, self) => {
        return ok(200, {
          visitors: self.visitors,
          metadata: query.metadata ? metadata : undefined,
        });
      }
    )
    .delete("/implode", [occupied_], async ({ metadata: meta }, self) => {
      self.storage.deleteAll();

      self.kv.delete(cacheKeySinglePasskey(meta));

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

export const cacheKeySinglePasskey = ({
  app,
  credentialId,
}: Pick<Metadata, "app" | "credentialId">) => `#app#${app}#id#${credentialId}`;

export const getPasskeyFromCache = (
  kv: KVNamespace,
  values: Pick<Metadata, "app" | "credentialId">
) => {
  return kv.get<Passkey>(cacheKeySinglePasskey(values), "json");
};

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
