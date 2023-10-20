import { fetcher } from "@mewhhaha/little-fetcher";
import { Plugin, PluginContext, Router } from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { empty, error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { $any, storageLoader, storageSaver } from "./helpers/durable";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { parsedBoolean } from "./helpers/parser";

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

  return { metadata: self.metadata };
}) satisfies Plugin<[DurableObjectUser]>;

type Metadata = {
  app: string;
  aliases: string[];
};

type Recovery = {
  emails: { address: string; verified: boolean; primary: boolean }[];
};

const parsePasskeyLink = type({ credentialId: "string", passkeyId: "string" });

type PasskeyLink = typeof parsePasskeyLink.infer;

export class DurableObjectUser implements DurableObject {
  metadata?: Metadata;
  recovery: Recovery = { emails: [] };

  passkeys: PasskeyLink[];

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

  occupy({
    email,
    passkey,
    aliases,
    app,
  }: Metadata & { email?: string; passkey?: PasskeyLink }) {
    this.save("metadata", { aliases, app });
    if (email) {
      this.save("recovery", {
        emails: [{ address: email, verified: false, primary: true }],
      });
    }
    if (passkey) {
      this.save("passkeys", [passkey]);
    }
  }

  static router = Router<[DurableObjectUser]>()
    .post(
      "/occupy",
      [
        data_(
          type({
            "email?": "email",
            app: "string",
            aliases: "string[]",
            "passkey?": parsePasskeyLink,
          })
        ),
      ],
      async ({ data }, self) => {
        if (self.metadata) {
          return error(403, "user_exists");
        }
        self.occupy(data);
        return ok(200);
      }
    )
    .post(
      "/verify-email",
      [occupied_, data_(type({ email: "email" }))],
      async ({ data }, self) => {
        const { emails } = self.recovery;
        const email = emails.find((e) => e.address === data.email);
        if (!email) {
          return error(404, { message: "email_not_found" });
        }
        email.verified = true;
        self.save("recovery", { emails });
        return ok(200);
      }
    )
    .post(
      "/link-passkey",
      [occupied_, data_(parsePasskeyLink)],
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
    .get(
      "/data",
      [
        occupied_,
        query_(
          type({ "recovery?": parsedBoolean, "passkeys?": parsedBoolean })
        ),
      ],
      async ({ metadata, query }, self) => {
        const data: {
          metadata: Metadata;
          recovery?: Recovery;
          passkeys?: PasskeyLink[];
        } = {
          metadata,
        };

        if (query.recovery) {
          data.recovery = self.recovery;
        }

        if (query.passkeys) {
          data.passkeys = self.passkeys;
        }

        return ok(200, data);
      }
    )
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
