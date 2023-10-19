import { fetcher } from "@mewhhaha/little-fetcher";
import { Plugin, PluginContext, Router } from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { empty, error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { $any, storageLoader, storageSaver } from "./helpers";

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
    return error(404, "user_unoccupied");
  }

  if (authorization !== self.metadata?.app) {
    return error(403, "app_mismatch");
  }

  return { meta: self.metadata };
}) satisfies Plugin<[DurableObjectUser]>;

type Metadata = {
  app: string;
  aliases: string[];
};

type Recovery = {
  email?: { address: string; verified: boolean };
};

export class DurableObjectUser implements DurableObject {
  metadata?: Metadata;
  recovery: Recovery = {};

  passkeys: { credentialId: string; passkeyId: string }[];

  storage: DurableObjectStorage;

  private save = storageSaver<DurableObjectUser>(this);
  private load = storageLoader<DurableObjectUser>(this);

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
    this.passkeys = [];

    state.blockConcurrencyWhile(async () => {
      await this.load("metadata", "recovery", "passkeys");
    });
  }

  occupy({ email, aliases, app }: Metadata & { email?: string }) {
    this.save("metadata", { aliases, app });
    if (email) {
      this.save("recovery", { email: { address: email, verified: false } });
    }
  }

  static router = Router<[DurableObjectUser]>()
    .post(
      "/occupy",
      [data_(type({ "email?": "email", app: "string", aliases: "string[]" }))],
      async ({ data }, self) => {
        if (self.metadata) {
          return error(403, "user_exists");
        }
        self.occupy(data);
        return ok(200);
      }
    )
    .post(
      "/add-passkey",
      [occupied_, data_(type({ passkeyId: "string", credentialId: "string" }))],
      async ({ data }, self) => {
        self.save("passkeys", [...self.passkeys, data]);
        return empty(204);
      }
    )
    .delete(
      "/remove-passkey/:passkeyId",
      [occupied_],
      async ({ params: { passkeyId } }, self) => {
        const updated = self.passkeys.filter((p) => p.passkeyId !== passkeyId);
        if (updated.length === self.passkeys.length) {
          return error(404, { message: "passkey_not_found" });
        }
        self.save("passkeys", updated);
        return empty(204);
      }
    )
    .get("/meta", [occupied_], async ({ meta }) => {
      return ok(200, meta);
    })
    .get("/recovery", [occupied_], async (_, self) => {
      return ok(200, self.recovery);
    })
    .all("/*", [], () => {
      return new Response("Not found", { status: 404 });
    });

  fetch(
    request: Request<unknown, CfProperties<unknown>>
  ): Response | Promise<Response> {
    return DurableObjectUser.router.handle(request, this);
  }
}

export const $user = $any<typeof DurableObjectUser>;
