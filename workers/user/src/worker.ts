import { Plugin, PluginContext, Router } from "@mewhhaha/little-router";
import { BodySend, mailChannels } from "./api/mail-channels";
import { error, ok } from "@mewhhaha/typed-response";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { type } from "arktype";
import { decodeHeader } from "@internal/keys";
import emailSendCode from "@internal/emails/dist/send-code.json";
import { $user } from "./user";
import { Env } from "./env";
import { decode, decodeJwt, encode, encodeJwt, jwtTime } from "@internal/jwt";
import { uuidv7 } from "uuidv7";
import { server } from "@passwordless-id/webauthn";
import {
  RegistrationParsed,
  parseRegistrationEncoded,
  parseSigninEncoded,
} from "./parsers";
import { hmac } from "./helpers";

export { DurableObjectUser } from "./user";

const server_ = (async (
  {
    request,
  }: PluginContext<{
    init: {
      headers: {
        Authorization: string;
      };
    };
  }>,
  env: Env
) => {
  const header = request.headers.get("Authorization");
  if (!header) {
    return error(401, { message: "authorization_missing" });
  }

  const app = await decodeHeader(env.SECRET_FOR_SERVER, "server", header);
  if (!app) {
    return error(403, { message: "authorization_invalid" });
  }

  return { app };
}) satisfies Plugin<[Env]>;

const client_ = (async (
  {
    request,
  }: PluginContext<{
    init: {
      headers: {
        Authorization: string;
      };
    };
  }>,
  env: Env
) => {
  const header = request.headers.get("Authorization");
  if (!header) {
    return error(401, { message: "authorization_missing" });
  }

  const app = await decodeHeader(env.SECRET_FOR_CLIENT, "client", header);
  if (!app) {
    return error(403, { message: "authorization_invalid" });
  }

  return { app };
}) satisfies Plugin<[Env]>;

const router = Router<[Env, ExecutionContext]>()
  .post(
    "/server/new-user",
    [
      server_,
      data_(
        type({
          aliases: "string[]",
          email: "string",
        })
      ),
    ],
    async ({ app, data: { email, aliases } }, env, ctx) => {
      const jurisdiction = env.DO_USER.jurisdiction("eu");
      const userId = jurisdiction.newUniqueId().toString();

      const challenge = generateRegisterChallenge();

      const { success: userCreated } = await insertUser(
        env.D1,
        env.SECRET_FOR_REGISTER,
        {
          userId,
          app,
          aliases,
          challenge,
        }
      );
      if (!userCreated) {
        return error(409, { message: "aliases_already_in_use" });
      }

      const user = $user(env.DO_USER, userId);

      const response = await user.post("/occupy", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, app, aliases }),
      });
      if (!response.ok) {
        return error(403, { message: "user_exists" });
      }

      const claim = {
        jti: challenge.id,
        sub: userId.toString(),
        exp: jwtTime(challenge.expiredAt),
        aud: app,
      };
      const token = await encodeJwt(env.SECRET_FOR_REGISTER, claim);

      const body = createBody({
        email,
        username: aliases[0] ?? email,
        code: challenge.code,
        dkim: env.DKIM_PRIVATE_KEY,
      });

      ctx.waitUntil(sendEmail(env.API_URL_MAILCHANNELS, body));

      return ok(200, { token });
    }
  )
  .post(
    "/server/new-device",
    [
      server_,
      data_(
        type({
          alias: "string",
        })
      ),
    ],
    async ({ app, data: { alias } }, env, ctx) => {
      const { success: foundAlias, userId } = await aliasedUserId(
        env.D1,
        app,
        alias
      );
      if (!foundAlias) {
        return error(404, { message: "user_missing" });
      }

      const jurisdiction = env.DO_USER.jurisdiction("eu");
      const user = $user(jurisdiction, userId);

      const response = await user.get("/meta", {
        headers: { Authorization: app },
      });
      if (!response.ok) {
        return error(404, { message: "user_missing" });
      }

      const { email } = await response.json();

      const challenge = generateRegisterChallenge();

      const { success: challengeAdded } = await beginRegister(
        env.D1,
        env.SECRET_FOR_REGISTER,
        challenge
      );
      if (!challengeAdded) {
        throw error(500, { message: "internal_error" });
      }

      const claim = {
        jti: challenge.id,
        sub: userId,
        exp: jwtTime(challenge.expiredAt),
        aud: app,
      };
      const token = await encodeJwt(env.SECRET_FOR_REGISTER, claim);

      const body = createBody({
        email,
        username: alias,
        code: challenge.code,
        dkim: env.DKIM_PRIVATE_KEY,
      });

      ctx.waitUntil(sendEmail(env.API_URL_MAILCHANNELS, body));

      return ok(200, { token });
    }
  )

  .post(
    "/server/list-credentials",
    [server_, data_(type({ userId: "string" }))],
    async ({ app, data }, env) => {
      try {
        const { results } = await env.D1.prepare(
          "SELECT credential, created_at AS createdAt, last_used_at AS lastUsedAt, country FROM device WHERE app_id = ? AND user_id = ?"
        )
          .bind(app, data.userId)
          .all<{
            credential: string;
            createdAt: string;
            lastUsedAt: string;
            country: string;
          }>();

        const credentials = results.map(({ credential, ...r }) => ({
          registration: JSON.parse(credential) as RegistrationParsed,
          ...r,
        }));

        return ok(200, { credentials });
      } catch {
        return error(404, { message: "user_missing" });
      }
    }
  )
  .post(
    "/server/delete-credential",
    [server_, data_(type({ userId: "string", credentialId: "string" }))],
    async ({ app, data }, env) => {
      try {
        await env.D1.prepare(
          "DELETE FROM device WHERE app_id = ? AND user_id = ? AND id = ?"
        )
          .bind(app, data.userId, data.credentialId)
          .run();

        return ok(200);
      } catch {
        throw error(500, { message: "internal_error" });
      }
    }
  )
  .post(
    "/server/verify-signin",
    [server_, data_(type({ token: "string", origin: "string" }))],
    async ({ app, data }, env) => {
      const { signinEncoded, claim, message } = await parseSigninToken(
        app,
        data.token,
        env.SECRET_FOR_SIGNIN
      );
      if (message === "token_invalid") {
        return error(401, "token_invalid");
      } else if (message) {
        return error(403, message);
      }

      const { success, expected, userId } = await completeSignin(env.D1, {
        challengeId: claim.jti,
        credentialId: signinEncoded.credentialId,
        app,
      });
      if (!success) {
        return error(410, { message: "challenge_expired" });
      }

      try {
        const result = await server.verifyAuthentication(
          signinEncoded,
          expected.credential,
          {
            challenge: encode(claim.jti),
            origin: data.origin,
            counter: expected.authenticator.counter,
            userVerified: true,
          }
        );

        return ok(200, {
          authentication: result,
          userId,
          credentialId: signinEncoded.credentialId,
        });
      } catch {
        return error(403, { message: "credential_invalid" });
      }
    }
  )
  .post(
    "/server/register-credential",
    [server_, data_(type({ token: "string", origin: "string" }))],
    async ({ app, request, data }, env) => {
      const { registrationEncoded, code, claim, message } =
        await parseRegistrationToken(app, data.token, env.SECRET_FOR_REGISTER);
      if (message === "token_invalid") {
        return error(401, "token_invalid");
      } else if (message) {
        return error(403, message);
      }

      const country = request.headers.get("cf-ipcountry") ?? "AQ";

      try {
        const registrationParsed = await server.verifyRegistration(
          registrationEncoded,
          {
            challenge: encode(claim.jti),
            origin: data.origin,
          }
        );

        const { success } = await completeRegister(
          env.D1,
          env.SECRET_FOR_REGISTER,
          {
            app,
            country,
            code,
            challengeId: claim.jti,
            userId: claim.sub,
            registration: registrationParsed,
          }
        );

        if (!success) {
          return error(410, { message: "challenge_expired" });
        }

        return ok(200, {
          userId: claim.sub,
          credentialId: registrationParsed.credential.id,
        });
      } catch (e) {
        return error(403, { message: "credential_invalid" });
      }
    }
  )
  .options("/client/signin-device", [], ({ request }) => {
    return new Response(undefined, {
      status: 204,
      headers: cors(request),
    });
  })
  .post("/client/signin-device", [client_], async ({ app, request }, env) => {
    const { token } = await beginSignin(env.D1, {
      secret: env.SECRET_FOR_SIGNIN,
      app,
    });

    return ok(
      200,
      { token },
      {
        headers: cors(request),
      }
    );
  })
  .all("/*", [], () => {
    return new Response("Not found", { status: 404 });
  });

const routes = router.infer;
/** @public */
export type Routes = typeof routes;

const handler: ExportedHandler<Env> = {
  fetch: router.handle,
  scheduled: async (_, env, ctx) => {
    ctx.waitUntil(
      env.D1.prepare("DELETE FROM challenge WHERE expired_at < ?")
        .bind(now())
        .run()
    );
  },
};

export default handler;

/**
 * --------------------------------------------------------------------
 * Helper functions
 * --------------------------------------------------------------------
 */

const parseSigninToken = async (app: string, token: string, secret: string) => {
  const [tokenRaw, signinRaw] = token.split("#");
  const { claim, message } = await parseClaim(secret, app, tokenRaw);
  if (!claim) {
    return { message };
  }

  const { data: signinEncoded, problems } = parseSigninEncoded(
    JSON.parse(decode(signinRaw))
  );
  if (problems) {
    return { message: "token_invalid" } as const;
  }

  return { signinEncoded, claim };
};

const parseRegistrationToken = async (
  app: string,
  token: string,
  secret: string
) => {
  const [tokenRaw, registrationRaw, codeRaw] = token.split("#");
  const { claim, message } = await parseClaim(secret, app, tokenRaw);
  if (!claim) {
    return { message } as const;
  }

  const code = decode(codeRaw);

  const { data: registrationEncoded, problems } = parseRegistrationEncoded(
    JSON.parse(decode(registrationRaw))
  );
  if (problems) {
    return { message: "token_invalid" } as const;
  }

  return { registrationEncoded, code, claim };
};

const cors = (request: Request) => ({
  "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "",
  "Access-Control-Allow-Method": "POST",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
});

const sendEmail = async (apiUrl: string, body: BodySend) => {
  const api = mailChannels(apiUrl);

  const response = await api.post("/send", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error(new Error(await response.text()));
  }
};

const createBody = ({
  email,
  username,
  code,
  dkim,
}: {
  email: string;
  username: string;
  code: string;
  dkim: string;
}): BodySend => {
  return {
    personalizations: [
      {
        to: [{ email, name: email.split("@")[0] }],
        // https://support.mailchannels.com/hc/en-us/articles/16918954360845-Secure-your-domain-name-against-spoofing-with-Domain-Lockdown-
        // https://support.mailchannels.com/hc/en-us/articles/7122849237389
        dkim_domain: "authfor.dev",
        dkim_selector: "mailchannels",
        dkim_private_key: dkim,
      },
    ],
    from: {
      email: "noreply@authfor.dev",
      name: `authfor.dev support`,
    },
    subject: `New device for ${username}`,
    content: [defaultEmail({ code })],
  };
};

const defaultEmail = ({ code }: { code: string }) =>
  ({
    type: "text/html",
    value: emailSendCode.html.replace("{{123456}}", code),
  } as const);

const insertUser = async (
  db: D1Database,
  secret: string,
  {
    app,
    aliases,
    userId,
    challenge: { id, code, expiredAt },
  }: {
    app: string;
    aliases: string[];
    userId: string;
    challenge: { id: string; code: string; expiredAt: Date };
  }
) => {
  const insertUser = db.prepare(
    "INSERT INTO user (id, created_at) VALUES (?, ?)"
  );
  const insertChallenge = db.prepare(
    "INSERT INTO challenge (id, expired_at, code) VALUES (?, ?, ?)"
  );
  const insertAlias = db.prepare(
    "INSERT INTO alias (name, created_at, app_id, user_id) VALUES (?, ?, ?, ?)"
  );

  const statements = [
    insertUser.bind(userId, now()),
    insertChallenge.bind(
      id,
      expiredAt.toISOString(),
      encode(await hmac(secret, code))
    ),
  ];
  for (const alias of aliases) {
    statements.push(insertAlias.bind(alias, now(), app, userId));
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

const beginRegister = async (
  db: D1Database,
  secret: string,
  { id, code, expiredAt }: { id: string; code: string; expiredAt: Date }
) => {
  const insertChallenge = db.prepare(
    "INSERT INTO challenge (id, expired_at, code) VALUES (?, ?, ?)"
  );

  try {
    const result = await insertChallenge
      .bind(id, expiredAt.toISOString(), encode(await hmac(secret, code)))
      .run();
    if (result.success) {
      return { success: true };
    }

    return { success: false };
  } catch (e) {
    return { success: false };
  }
};

const beginSignin = async (
  db: D1Database,
  { secret, app }: { secret: string; app: string }
) => {
  const id = uuidv7();

  const claim = {
    jti: id,
    sub: "discoverable",
    exp: jwtTime(minute5()),
    aud: app,
  };

  const token = await encodeJwt(secret, claim);

  const result = await db
    .prepare("INSERT INTO challenge (id, expired_at) VALUES (?, ?)")
    .bind(claim.jti, minute5().toISOString())
    .run();

  if (!result.success) {
    console.error(result.error);
  }

  return { token };
};

const completeSignin = async (
  db: D1Database,
  {
    challengeId,
    credentialId,
    app,
  }: { challengeId: string; credentialId: string; app: string }
) => {
  try {
    const consumed = await db
      .prepare("DELETE FROM challenge WHERE id = ? RETURNING *")
      .bind(challengeId)
      .first();

    if (!consumed) {
      return { success: false } as const;
    }

    const batch = await db.batch<{ credential: string; userId: string }>([
      db
        .prepare(
          "SELECT credential, user_id AS userId FROM device where id = ? AND app_id = ?"
        )
        .bind(credentialId, app),
      db
        .prepare(
          "UPDATE device SET last_used_at = ? WHERE id = ? AND app_id = ?"
        )
        .bind(now(), credentialId, app),
    ]);

    const { credential, userId } = batch[0]?.results[0] ?? {};
    if (credential === undefined || userId === undefined) {
      return { success: false } as const;
    }

    const expected: RegistrationParsed = JSON.parse(credential);

    return { success: true, expected, userId } as const;
  } catch (e) {
    if (e instanceof Error) console.log(e.message);
    return { success: false } as const;
  }
};

const completeRegister = async (
  db: D1Database,
  secret: string,
  {
    challengeId,
    code,
    userId,
    country,
    registration,
    app,
  }: {
    challengeId: string;
    userId: string;
    code: string;
    registration: RegistrationParsed;
    country: string;
    app: string;
  }
) => {
  try {
    const consumed = await db
      .prepare("DELETE FROM challenge WHERE id = ? AND code = ? RETURNING *")
      .bind(challengeId, encode(await hmac(secret, code)))
      .first();

    if (!consumed) {
      return { success: false };
    }
    const results = await db.batch([
      db
        .prepare(
          "INSERT INTO device (id, created_at, last_used_at, country, app_id, user_id, credential) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          registration.credential.id,
          now(),
          now(),
          country,
          app,
          userId,
          JSON.stringify(registration)
        ),
      db.prepare("UPDATE user SET verified = 1 WHERE id = ?").bind(userId),
    ]);

    return { success: results.every((r) => r.success) };
  } catch (e) {
    if (e instanceof Error) console.log(e.message);
    return { success: false };
  }
};

const aliasedUserId = async (db: D1Database, app: string, alias: string) => {
  try {
    const result = await db
      .prepare(
        `SELECT user_id AS userId FROM alias WHERE app_id = ? AND name = ?`
      )
      .bind(app, alias)
      .first<{ userId: string }>();

    if (result) {
      return { success: true, userId: result.userId } as const;
    }
    return { success: false } as const;
  } catch (e) {
    if (e instanceof Error) console.log(e.message);
    return { success: false } as const;
  }
};

const minute10 = () => fromNow(1000 * 60 * 10);
const minute5 = () => fromNow(1000 * 60 * 5);

const fromNow = (ms: number) => {
  return new Date(new Date().getTime() + ms);
};

const parseClaim = async (secret: string, aud: string, token: string) => {
  const claim = await decodeJwt(secret, token);
  if (!claim) {
    return { message: "token_invalid" } as const;
  }

  if (jwtTime(new Date()) >= claim.exp) {
    return { message: "token_expired" } as const;
  }

  if (claim.aud !== aud) {
    return { message: "audience_mismatch" } as const;
  }

  return { claim } as const;
};

const generateCode = (numberOfCharacters: number) => {
  const buffer = new Uint8Array(numberOfCharacters);
  const randomBuffer = crypto.getRandomValues(buffer);
  return [...randomBuffer]
    .map((value) => CHARACTERS[value % CHARACTERS.length])
    .join("");
};

const CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const generateRegisterChallenge = () => ({
  id: uuidv7(),
  expiredAt: minute10(),
  code: generateCode(8),
});

const now = () => new Date().toISOString();
