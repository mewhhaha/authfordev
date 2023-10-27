import { jsonBody, tryResult } from "@internal/common";
import { route } from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { err, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { kvAlias, type HashedAlias, hashAliases } from "../helpers/alias.js";
import { $passkey, guardPasskey } from "../passkey.js";
import { type ServerAppName, server_ } from "../plugins/server.js";
import { $user, makePasskeyLink } from "../user.js";
import { $challenge } from "../challenge.js";
import { parseRegistrationToken } from "../helpers/parser.js";
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

    const { registration, claim, message } = await parseRegistrationToken(
      token,
      { app, secret: env.SECRET_FOR_PASSKEY }
    );
    if (message !== undefined) {
      return err(403, { message });
    }

    const challenge = $challenge(env.DO_CHALLENGE, claim.jti);
    const { success: passed } = await finishChallenge(challenge);
    if (!passed) {
      return err(403, { message: "challenge_expired" });
    }

    const credentialId = registration.credential.id;
    const passkeyId = jurisdiction.passkey.idFromName(credentialId);
    const passkey = $passkey(jurisdiction.passkey, passkeyId);
    const userId = jurisdiction.user.newUniqueId();
    const user = $user(jurisdiction.user, userId);

    const data = {
      app,
      userId: userId.toString(),
      registration,
      origin,
      challengeId: claim.jti,
      visitor: claim.vis,
    };
    const { success: registered } = await passkey
      .post("/start-register", jsonBody(data))
      .then(tryResult);

    if (!registered) {
      return err(403, { message: "passkey_exists" });
    }

    const hashedAliases = await hashAliases(env.SECRET_FOR_ALIAS, aliases);

    const { success: userInserted } = await insertUser(env.D1, {
      userId: userId.toString(),
      app,
      aliases: hashedAliases,
    });
    if (!userInserted) {
      return err(409, { message: "aliases_taken" });
    }

    const passkeyLink = makePasskeyLink({ passkeyId, credentialId, userId });

    // This is intentionally not hashed aliases so a user can read its aliases in plain text
    const payload = { email, app, aliases, passkey: passkeyLink };
    const { success: userCreated } = await user
      .post("/occupy", jsonBody(payload))
      .then(tryResult);
    if (!userCreated) {
      return err(403, { message: "user_exists" });
    }

    const postUpdate = async () => {
      const finishPasskey = passkey.post("/finish-register", {
        headers: { Authorization: guardPasskey(app, userId) },
      });
      const cacheAliases = Promise.all(
        hashedAliases.map(async (alias) => {
          await env.KV_ALIAS.put(kvAlias(app, alias), userId.toString());
        })
      );
      await Promise.all([finishPasskey, cacheAliases]);
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
