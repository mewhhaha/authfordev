import {
  type Plugin,
  type PluginContext,
  Router,
} from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { $any, storageLoader, storageSaver } from "./helpers/durable";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { parsedBoolean } from "./helpers/parser";

export type GuardUser = `user:${string}`;

export const guardUser = (app: string) => {
  return `user:${app}` as const;
};

const unoccupied_ = ((_: PluginContext<any>, self) => {
  if (self.metadata !== undefined) {
    return error(409, "user_exists");
  }

  return {};
}) satisfies Plugin<[DurableObjectUser]>;

const occupied_ = ((
  {
    request,
  }: PluginContext<{
    // This should be `user:${app}`
    init: { headers: { Authorization: GuardUser } };
  }>,
  self
) => {
  const authorization = request.headers.get("Authorization");
  if (authorization === null) {
    return error(401, "authorization_missing");
  }

  if (self.metadata === undefined) {
    return error(404, "user_missing");
  }

  // First word is just user:
  const [, app] = authorization.split(":");

  if (app !== self.metadata?.app) {
    console.log(self.metadata);
    return error(403, "app_mismatch");
  }

  return { metadata: self.metadata };
}) satisfies Plugin<[DurableObjectUser]>;

// This should be #${app}:${userId}

export type Metadata = {
  app: string;
  aliases: string[];
};

export type Recovery = {
  emails: { address: string; verified: boolean; primary: boolean }[];
};

const parsePasskeyLink = type({
  name: "1<=string<=60",
  credentialId: "string",
  userId: "string",
  passkeyId: "string",
});

const parseOccupyData = type({
  "email?": "email",
  app: "string",
  aliases: "string[]",
  "passkey?": parsePasskeyLink,
});

export type PasskeyLink = typeof parsePasskeyLink.infer;

export class DurableObjectUser implements DurableObject {
  metadata?: Metadata;
  recovery: Recovery = { emails: [] };

  passkeys: PasskeyLink[];

  storage: DurableObjectStorage;

  readonly save = storageSaver<DurableObjectUser>(this);
  readonly load = storageLoader<DurableObjectUser>(this);

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
    this.passkeys = [];

    void state.blockConcurrencyWhile(async () => {
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
    if (email !== undefined) {
      this.save("recovery", {
        emails: [{ address: email, verified: false, primary: true }],
      });
    }
    if (passkey !== undefined) {
      this.save("passkeys", [passkey]);
    }
  }

  static router = Router<[DurableObjectUser]>()
    .post(
      "/occupy",
      [unoccupied_, data_(parseOccupyData)],
      async ({ data }, self) => {
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
        if (email === undefined) {
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
        return ok(200, { passkeys: self.passkeys });
      }
    )
    .put(
      "/rename-passkey/:passkeyId",
      [occupied_, data_(type({ name: "1<=string<=60" }))],
      async ({ params: { passkeyId }, data: { name } }, self) => {
        const passkey = self.passkeys.find((p) => p.passkeyId === passkeyId);
        if (passkey === undefined) {
          return error(404, { message: "passkey_missing" });
        }

        passkey.name = name;
        self.save("passkeys", self.passkeys);

        return ok(200, { passkeys: self.passkeys });
      }
    )
    .delete(
      "/remove-passkey/:passkeyId",
      [occupied_],
      async ({ params: { passkeyId } }, self) => {
        const removed = self.passkeys.filter((p) => p.passkeyId !== passkeyId);
        if (removed.length === self.passkeys.length) {
          return error(404, { message: "passkey_not_found" });
        }
        self.save("passkeys", removed);
        return ok(200, { passkeys: self.passkeys });
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
      async (
        { metadata, query: { recovery = false, passkeys = false } },
        self
      ) => {
        const data: {
          metadata: Metadata;
          recovery?: Recovery;
          passkeys?: PasskeyLink[];
        } = {
          metadata,
        };

        if (recovery) {
          data.recovery = self.recovery;
        }

        if (passkeys) {
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
