import { Router } from "@mewhhaha/little-router";
import { error, ok } from "@mewhhaha/typed-response";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { type } from "arktype";
import { type Env } from "./helpers/env.js";
import { encodeJwt, jwtTime } from "@internal/jwt";
import { server } from "@passwordless-id/webauthn";
import {
  type Credential,
  type Visitor,
  parsedBoolean,
  parseClaim,
  parseAuthenticationToken,
  parseRegistrationToken,
} from "./helpers/parser.js";
import { $challenge } from "./challenge.js";
import { $user, type GuardUser, type PasskeyLink, guardUser } from "./user.js";
import {
  $passkey,
  makeVisitor,
  type GuardPasskey,
  guardPasskey,
} from "./passkey.js";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { createBody, sendEmail } from "./helpers/email.js";
import { minute1, now } from "./helpers/time.js";
import { client_ } from "./plugins/client.js";
import { type ServerAppName, server_ } from "./plugins/server.js";
import {
  jsonBody,
  hmac,
  tryResult,
  encode,
  decode,
  type TaggedType,
  invariant,
} from "@internal/common";

export { type Visitor } from "./helpers/parser.js";
export { type Metadata as PasskeyMetadata } from "./passkey.js";
export { DurableObjectUser } from "./user.js";
export { DurableObjectChallenge } from "./challenge.js";
export { DurableObjectPasskey } from "./passkey.js";
export {
  type Metadata as UserMetadata,
  type Recovery as UserRecovery,
} from "./user.js";

type HashedAlias = TaggedType<string, "hashed_alias">;

const router = Router<[Env, ExecutionContext]>()
  .get(
    "/server/aliases/:alias",
    [server_],
    async ({ app, params: { alias } }, env) => {
      const kvKey = kvAlias(app, await hashAlias(env.SECRET_FOR_ALIAS, alias));
      const userId = await env.KV_ALIAS.get(kvKey);
      return ok(200, { userId: userId ?? undefined });
    }
  )
  .post(
    "/server/users",
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

      const { message, credential, passkeyId, visitor } =
        await verifyRegistration(token, env, { app, origin });
      if (message !== undefined) {
        return error(403, { message });
      }

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
  )
  .post(
    "/server/users/:userId/passkeys",
    [server_, data_(type({ token: "string", origin: "string" }))],
    async (
      { app, params: { userId: userIdString }, data: { token, origin } },
      env
    ) => {
      const jurisdiction = {
        user: env.DO_USER.jurisdiction("eu"),
        passkey: env.DO_PASSKEY.jurisdiction("eu"),
      };

      const { message, passkeyId, credential, visitor } =
        await verifyRegistration(token, env, { app, origin });
      if (message !== undefined) {
        return error(403, { message });
      }

      const userId = jurisdiction.user.idFromString(userIdString);
      const user = $user(jurisdiction.user, userId);
      const passkeyLink = makePasskeyLink({ passkeyId, credential, userId });
      const guard = guardUser(app);
      const linked = await linkPasskey(user, { passkeyLink, guard });
      if (linked === undefined) {
        return error(404, { message: "user_missing" });
      }

      const passkey = $passkey(jurisdiction.passkey, passkeyId);
      const payload = { app, visitor, userId, credential };
      await createPasskey(passkey, payload);

      return ok(201, {
        userId,
        passkeyId: passkeyId.toString(),
      });
    }
  )
  .get(
    "/server/users/:userId/passkeys/:passkeyId",
    [server_, query_(type({ "visitors?": parsedBoolean }))],
    async (
      { app, query: { visitors = false }, params: { userId, passkeyId } },
      env
    ) => {
      const jurisdiction = env.DO_PASSKEY.jurisdiction("eu");
      const passkey = $passkey(jurisdiction, passkeyId);
      const guard = guardPasskey(app, userId);
      const { success, result } = await passkey
        .get(`/data?visitors=${visitors}`, {
          headers: { Authorization: guard },
        })
        .then(tryResult);

      if (!success) {
        return error(404, "passkey_missing");
      }

      return ok(200, result);
    }
  )

  .get(
    "/server/users/:userId",
    [
      server_,
      query_(type({ "recovery?": parsedBoolean, "passkeys?": parsedBoolean })),
    ],
    async (
      {
        app,
        query: { recovery = false, passkeys = false },
        params: { userId: userIdString },
      },
      env
    ) => {
      const jurisdiction = env.DO_USER.jurisdiction("eu");
      const user = $user(jurisdiction, userIdString);
      const { success, result } = await user
        .get(`/data?recovery=${recovery}&passkeys=${passkeys}`, {
          headers: { Authorization: guardUser(app) },
        })
        .then(tryResult);

      if (!success) {
        return error(404, { message: "user_missing" });
      }

      return ok(200, result);
    }
  )
  .delete(
    "/server/users/:userId/passkeys/:passkeyId",
    [server_],
    async ({ app, params: { userId, passkeyId } }, env) => {
      const jurisdiction = {
        passkey: env.DO_PASSKEY.jurisdiction("eu"),
        user: env.DO_USER.jurisdiction("eu"),
      };

      const user = $user(jurisdiction.user, userId);
      const passkey = $passkey(jurisdiction.passkey, passkeyId);

      const [removedLink, removedPasskey] = await Promise.all([
        removePasskeyLink(user, { guard: guardUser(app), passkeyId }),
        removePasskey(passkey, { guard: guardPasskey(app, userId) }),
      ]);

      if (removedLink === undefined || removedPasskey === undefined) {
        return error(404, { message: "passkey_missing" });
      }

      return ok(200, removedPasskey);
    }
  )
  .put(
    "/server/users/:userId/rename-passkey/:passkeyId",
    [server_, data_(type({ name: "string" }))],
    async ({ app, data, params: { userId, passkeyId } }, env) => {
      const jurisdiction = {
        passkey: env.DO_PASSKEY.jurisdiction("eu"),
        user: env.DO_USER.jurisdiction("eu"),
      };

      const user = $user(jurisdiction.user, userId);
      const { success } = await user
        .put(`/rename-passkey/${passkeyId}`, jsonBody(data, guardUser(app)))
        .then(tryResult);

      if (!success) {
        return error(404, { message: "passkey_missing" });
      }

      return ok(200, data);
    }
  )
  .post(
    "/server/actions/check-aliases",
    [
      server_,
      data_(
        type({
          aliases: "string<60[]",
        })
      ),
    ],
    async ({ app, data: { aliases } }, env) => {
      const result = await Promise.all(
        aliases.map(async (alias) => {
          const hashedAlias = await hashAlias(env.SECRET_FOR_ALIAS, alias);
          return await env.KV_ALIAS.get(kvAlias(app, hashedAlias)).then(
            (result) => [alias, result !== null] as const
          );
        })
      );
      return ok(200, { aliases: result });
    }
  )
  .post(
    "/server/actions/send-email-code",
    [server_, data_(type({ alias: "string", "email?": "email" }))],
    async ({ data: { alias, email: specifiedAddress }, app }, env, ctx) => {
      const jurisdiction = env.DO_USER.jurisdiction("eu");
      const code = generateCode(8);

      const hashedAlias = await hashAlias(env.SECRET_FOR_ALIAS, alias);
      const userId = await env.KV_ALIAS.get(kvAlias(app, hashedAlias));
      if (userId === null) {
        return error(404, { message: "user_missing" });
      }

      const { success: foundUser, result } = await $user(jurisdiction, userId)
        .get("/data?recovery=true", {
          headers: { Authorization: guardUser(app) },
        })
        .then(tryResult);
      if (!foundUser) {
        console.log("Alias didn't result in a proper user for some reason");
        return error(404, { message: "user_missing" });
      }

      invariant(result.recovery, "included because of query param");

      const address = result.recovery.emails.find((e) => {
        if (specifiedAddress === undefined) {
          return e.primary && e.verified;
        } else {
          return e.address === specifiedAddress;
        }
      })?.address;

      if (address === undefined) {
        return error(400, { message: "email_missing" });
      }

      const body = createBody({
        email: address,
        username: alias,
        dkim: env.DKIM_PRIVATE_KEY,
        code,
      });

      const challengeId = env.DO_CHALLENGE.newUniqueId();

      const minute30 = 1000 * 60 * 30;

      const challenge = $challenge(env.DO_CHALLENGE, challengeId);

      const postSend = async () => {
        await Promise.all([
          sendEmail(env.API_URL_MAILCHANNELS, body),
          startChallenge(challenge, {
            ms: minute30,
            code,
            value: `${userId}:${encode(address)}`,
          }),
        ]);
      };

      ctx.waitUntil(postSend());

      const claim = encodeJwt(env.SECRET_FOR_SEND_CODE, {
        jti: challengeId.toString(),
        sub: "anonymous",
        exp: jwtTime(new Date(Date.now() + minute30)),
        aud: app,
      });

      return ok(202, { token: claim });
    }
  )
  .post(
    "/server/actions/verify-email-code",
    [server_, data_(type({ token: "string", code: "string" }))],
    async ({ data: { token, code }, app }, env) => {
      const { message, claim } = await parseClaim(
        env.SECRET_FOR_SEND_CODE,
        app,
        token
      );
      if (message !== undefined) {
        return error(403, message);
      }

      const challenge = $challenge(env.DO_CHALLENGE, claim.jti);
      const { success: passed, result } = await finishChallenge(
        challenge,
        code
      );
      if (!passed) {
        return error(403, { message: "challenge_expired" });
      }

      const [userId, email] = result.split(":");
      if (userId === undefined || email === undefined) {
        return error(401, { message: "challenge_invalid" });
      }

      return ok(200, { userId, email: decode(email) });
    }
  )
  .post(
    "/server/actions/verify-passkey",
    [server_, data_(type({ token: "string", origin: "string" }))],
    async ({ app, data: { origin, token } }, env) => {
      const jurisdiction = { passkey: env.DO_PASSKEY.jurisdiction("eu") };

      const { authentication, challengeId, visitor, message } =
        await parseAuthenticationToken(token, {
          app,
          secret: env.SECRET_FOR_PASSKEY,
        });
      if (message === "token_invalid") {
        return error(401, "token_invalid");
      }

      if (message !== undefined) {
        return error(403, message);
      }

      const challenge = $challenge(env.DO_CHALLENGE, challengeId);
      const { success: passed } = await finishChallenge(challenge);
      if (!passed) {
        return error(410, { message: "challenge_expired" });
      }

      const passkeyId = jurisdiction.passkey.idFromName(
        authentication.credentialId
      );
      const passkey = $passkey(jurisdiction.passkey, passkeyId);

      const payload = { app, origin, challengeId, visitor, authentication };
      const response = await passkey.post("/authenticate", jsonBody(payload));

      if (!response.ok) {
        return error(403, { message: "passkey_invalid" });
      }

      const { metadata } = await response.json();

      return ok(200, {
        userId: metadata.userId,
        passkeyId: metadata.passkeyId,
      });
    }
  )
  .post(
    "/client/challenge-passkey",
    [client_],
    async ({ request, app }, env, ctx) => {
      const id = env.DO_CHALLENGE.newUniqueId();

      const claim = {
        jti: id.toString(),
        sub: "anonymous",
        exp: jwtTime(minute1()),
        vis: makeVisitor(request),
        aud: app,
      };

      const token = await encodeJwt<{ vis: Visitor }>(
        env.SECRET_FOR_PASSKEY,
        claim
      );

      const challenge = $challenge(env.DO_CHALLENGE, id);
      ctx.waitUntil(startChallenge(challenge));

      return ok(200, { token }, { headers: cors(request) });
    }
  )
  .all("/*", [], () => new Response("Not found", { status: 404 }));

const routes = router.infer;
/** @public */
export type Routes = typeof routes;

const handler: ExportedHandler<Env> = {
  fetch: router.handle,
};

export default handler;

/**
 * --------------------------------------------------------------------
 * Helper functions
 * --------------------------------------------------------------------
 */

const cors = (request: Request) => ({
  "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "",
  "Access-Control-Allow-Method": "POST",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
});

const generateCode = (numberOfCharacters: number) => {
  const buffer = new Uint8Array(numberOfCharacters);
  const randomBuffer = crypto.getRandomValues(buffer);
  return [...randomBuffer]
    .map((value) => CHARACTERS[value % CHARACTERS.length])
    .join("");
};

const CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const finishChallenge = async (
  challenge: ReturnType<typeof $challenge>,
  code?: string
) => {
  return await challenge
    .post("/finish", {
      body: code,
    })
    .then(tryResult);
};

const startChallenge = async (
  challenge: ReturnType<typeof $challenge>,
  data: { ms?: number; code?: string; value?: string } = {}
) => await challenge.post(`/start`, jsonBody(data)).then(tryResult);

const createPasskey = async (
  passkey: ReturnType<typeof $passkey>,
  data: {
    userId: DurableObjectId | string;
    app: ServerAppName;
    credential: Credential;
    visitor: Visitor;
  }
) => {
  return await passkey
    .post("/occupy", jsonBody({ ...data, userId: `${data.userId.toString()}` }))
    .then(tryResult);
};

const linkPasskey = async (
  user: ReturnType<typeof $user>,
  {
    guard,
    passkeyLink,
  }: {
    guard: GuardUser;
    passkeyLink: PasskeyLink;
  }
) => {
  return await user
    .post("/link-passkey", jsonBody(passkeyLink, guard))
    .then(tryResult);
};

const removePasskeyLink = async (
  user: ReturnType<typeof $user>,
  {
    guard,
    passkeyId,
  }: {
    guard: GuardUser;
    passkeyId: DurableObjectId | string;
  }
) => {
  return await user
    .delete(`/remove-passkey/${passkeyId.toString()}`, {
      headers: { Authorization: guard },
    })
    .then(tryResult);
};

const removePasskey = async (
  passkey: ReturnType<typeof $passkey>,
  { guard }: { guard: GuardPasskey }
) => {
  return await passkey
    .delete("/implode", {
      headers: { Authorization: guard },
    })
    .then(tryResult);
};

const kvAlias = (app: ServerAppName, hashedAlias: HashedAlias) =>
  `#app#${app}#alias#${hashedAlias}`;

const hashAlias = async (secret: Env["SECRET_FOR_ALIAS"], alias: string) =>
  encode(await hmac(secret, alias)) as HashedAlias;

const hashAliases = async (
  secret: Env["SECRET_FOR_ALIAS"],
  aliases: string[]
) => {
  return await Promise.all(
    aliases.map(async (alias) => await hashAlias(secret, alias))
  );
};

const verifyRegistration = async (
  token: string,
  env: Env,
  { app, origin }: { app: ServerAppName; origin: string }
) => {
  const jurisdiction = env.DO_PASSKEY.jurisdiction("eu");
  try {
    const { registrationEncoded, claim, message } =
      await parseRegistrationToken(token, {
        app,
        secret: env.SECRET_FOR_PASSKEY,
      });
    if (message !== undefined) {
      return { message } as const;
    }

    const challenge = $challenge(env.DO_CHALLENGE, claim.jti);
    const { success: passed } = await finishChallenge(challenge);
    if (!passed) {
      return { message: "challenge_expired" } as const;
    }

    const registrationParsed = await server.verifyRegistration(
      registrationEncoded,
      { challenge: encode(claim.jti), origin }
    );

    const { credential } = registrationParsed;
    const passkeyId = jurisdiction.idFromName(credential.id);

    return {
      credential,
      passkeyId,
      visitor: claim.vis,
    } as const;
  } catch {
    return { message: "passkey_invalid" } as const;
  }
};

const makePasskeyLink = ({
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
