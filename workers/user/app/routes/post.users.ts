import { encode, jsonBody, tryResult } from "@internal/common";
import { route } from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { kvAlias, type HashedAlias, hashAliases } from "../helpers/alias.js";
import { $passkey } from "../passkey.js";
import { type ServerAppName, server_ } from "../plugins/server.js";
import { $user, makePasskeyLink } from "../user.js";
import { server } from "@passwordless-id/webauthn";
import { $challenge } from "../challenge.js";
import {
  parseRegistrationToken,
  type Credential,
  type Visitor,
} from "../helpers/parser.js";
import { now } from "../helpers/time.js";

export default route(
  PATTERN,
  [
    server_,
    data_(
      type({
        aliases: "1<=(2<=string<=60)[]<4",
        "email?": "string",
        token: "string",
        origin: "string",
      })
    ),
  ],
  async ({ app, data: { email, aliases, token, origin } }, env, ctx) => {
    const jurisdiction = {
      user: env.DO_USER.jurisdiction("eu"),
      passkey: env.DO_PASSKEY.jurisdiction("eu"),
    };

    const { message, credential, visitor } = await verifyRegistration(
      token,
      env.DO_CHALLENGE,
      { app, origin, secret: env.SECRET_FOR_PASSKEY }
    );
    if (message !== undefined) {
      return error(403, { message });
    }

    const passkeyId = jurisdiction.passkey.idFromName(credential.id);
    const userId = jurisdiction.user.newUniqueId();

    const hashedAliases = await hashAliases(env.SECRET_FOR_ALIAS, aliases);

    const { success: userInserted } = await insertUser(env.D1, {
      userId: userId.toString(),
      app,
      aliases: hashedAliases,
    });
    if (!userInserted) {
      return error(409, { message: "aliases_taken" });
    }

    const passkeyLink = makePasskeyLink({ passkeyId, credential, userId });

    // This is intentionally not hashed aliases so a user can read its aliases in plain text
    const payload = { email, app, aliases, passkey: passkeyLink };
    const { success: userCreated } = await $user(jurisdiction.user, userId)
      .post("/occupy", jsonBody(payload))
      .then(tryResult);
    if (!userCreated) {
      return error(403, { message: "user_exists" });
    }

    const postUpdate = async () => {
      const passkey = $passkey(jurisdiction.passkey, passkeyId);
      await Promise.all([
        createPasskey(passkey, { app, visitor, userId, credential }),
        hashedAliases.map(async (alias) => {
          await env.KV_ALIAS.put(kvAlias(app, alias), userId.toString());
        }),
      ]);
    };

    ctx.waitUntil(postUpdate());

    return ok(201, {
      userId: userId.toString(),
      passkeyId: passkeyId.toString(),
    });
  }
);

const finishChallenge = async (challenge: ReturnType<typeof $challenge>) => {
  return await challenge.post("/finish").then(tryResult);
};

const verifyRegistration = async (
  token: string,
  namespace: Env["DO_CHALLENGE"],
  {
    app,
    origin,
    secret,
  }: { app: ServerAppName; origin: string; secret: Env["SECRET_FOR_PASSKEY"] }
) => {
  try {
    const { registrationEncoded, claim, message } =
      await parseRegistrationToken(token, {
        app,
        secret,
      });
    if (message !== undefined) {
      return { message } as const;
    }

    const challenge = $challenge(namespace, claim.jti);
    const { success: passed } = await finishChallenge(challenge);
    if (!passed) {
      return { message: "challenge_expired" } as const;
    }

    const registrationParsed = await server.verifyRegistration(
      registrationEncoded,
      { challenge: encode(claim.jti), origin }
    );

    const { credential } = registrationParsed;

    return {
      credential,

      visitor: claim.vis,
    } as const;
  } catch {
    return { message: "passkey_invalid" } as const;
  }
};

const insertUser = async (
  db: D1Database,
  {
    app,
    aliases,
    userId,
  }: {
    app: ServerAppName;
    aliases: HashedAlias[];
    userId: string;
  }
) => {
  const createdAt = now();
  const userStatement = db.prepare(
    "INSERT INTO user (id, created_at) VALUES (?, ?)"
  );
  const aliasStatement = db.prepare(
    "INSERT INTO alias (name, created_at, app_id, user_id) VALUES (?, ?, ?, ?)"
  );

  const statements = [userStatement.bind(userId, createdAt)];

  for (const alias of aliases) {
    statements.push(aliasStatement.bind(alias, createdAt, app, userId));
  }

  try {
    const results = await db.batch(statements);
    if (results.every((r) => r.success)) {
      return { success: true };
    }

    return { success: false };
  } catch (e) {
    return { success: false };
  }
};

const createPasskey = async (
  passkey: ReturnType<typeof $passkey>,
  data: {
    userId: DurableObjectId | string;
    app: ServerAppName;
    credential: Credential;
    visitor: Visitor;
  }
) => {
  return await passkey.post(
    "/occupy",
    jsonBody({ ...data, userId: `${data.userId.toString()}` })
  );
};
