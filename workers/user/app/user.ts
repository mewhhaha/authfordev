import {
  type Plugin,
  type PluginContext,
  Router,
} from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { $any, storageLoader, storageSaver } from "./helpers/durable.js";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { type Credential, parsedBoolean } from "./helpers/parser.js";
import { type ServerAppName } from "./plugins/server.js";
export { type JSONString } from "@mewhhaha/json-string";

export type GuardUser = `user:${ServerAppName}`;

export const guardUser = (app: ServerAppName) => {
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
    return error(401, { message: "authorization_missing" });
  }

  if (self.metadata === undefined) {
    return error(404, { message: "user_missing" });
  }

  // First word is just user:
  const [, app] = authorization.split(":");

  if (app !== self.metadata?.app) {
    console.log(self.metadata);
    return error(403, { message: "app_mismatch" });
  }

  return { metadata: self.metadata };
}) satisfies Plugin<[DurableObjectUser]>;

// This should be #${app}:${userId}

/** @public */
export type Metadata = {
  app: string;
  aliases: string[];
};

/** @public */
export type Recovery = {
  emails: { address: string; verified: boolean; primary: boolean }[];
};

const parsePasskeyLink = type({
  name: "1<=string<=60",
  credentialId: "1<=string<=256",
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

export const $user = $any<typeof DurableObjectUser, Env["DO_USER"]>;

export const makePasskeyLink = ({
  passkeyId,
  credential,
  userId,
}: {
  passkeyId: DurableObjectId | string;
  credential: Credential;
  userId: DurableObjectId | string;
}): PasskeyLink => {
  const passkeyIdString = passkeyId.toString();
  return {
    passkeyId: passkeyIdString,
    credentialId: credential.id,
    userId: userId.toString(),
    name: `passkey-${passkeyIdString.slice(0, 3) + passkeyIdString.slice(-3)}`,
  };
};
