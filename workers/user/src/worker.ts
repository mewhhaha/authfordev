import { Plugin, PluginContext, Router } from "@mewhhaha/little-router";
import { BodySend, mailChannels } from "./api/mail-channels";
import { empty, error, ok } from "@mewhhaha/typed-response";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { type } from "arktype";
import { decodeHeader } from "@internal/keys";
import emailSendCode from "@internal/emails/dist/send-code.json";
import { Env } from "./env";
import { decode, decodeJwt, encode, encodeJwt, jwtTime } from "@internal/jwt";
import { server } from "@passwordless-id/webauthn";
import {
  Credential,
  parseRegistrationEncoded,
  parseAuthenticationEncoded,
} from "./parsers";
import { $challenge } from "./challenge";
import { $user } from "./user";
import {
  $passkey,
  Visitor,
  getListPasskeyFromCache,
  getPasskeyFromCache,
} from "./passkey";
import { now } from "./helpers";

export { DurableObjectUser } from "./user";
export { DurableObjectChallenge } from "./challenge";
export { DurableObjectPasskey } from "./passkey";

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
    init: { body: string; headers?: { "Content-Type": "text/plain" } };
  }>,
  env: Env
) => {
  const clientKey = await request.text();

  if (!clientKey) {
    throw error(500);
  }

  const app = await decodeHeader(env.SECRET_FOR_CLIENT, "client", clientKey);
  if (!app) {
    return error(403, { message: "authorization_invalid" });
  }

  return { app };
}) satisfies Plugin<[Env]>;

const router = Router<[Env, ExecutionContext]>()
  .post(
    "/server/users",
    [
      server_,
      data_(
        type({
          aliases: "1<=(string<60)[]<4",
          "email?": "string",
          token: "string",
          origin: "string",
        })
      ),
    ],
    async ({ app, data: { email, aliases, token, origin } }, env, ctx) => {
      try {
        const jurisdiction = {
          user: env.DO_USER.jurisdiction("eu"),
          passkey: env.DO_PASSKEY.jurisdiction("eu"),
        };

        const { registrationEncoded, claim, message } =
          await parseRegistrationToken(app, token, env.SECRET_FOR_PASSKEY);
        if (message) {
          return error(403, { message });
        }

        const passed = await finishChallenge(env.DO_CHALLENGE, claim.jti);
        if (!passed) {
          return error(403, { message: "challenge_expired" });
        }

        try {
          const registrationParsed = await server.verifyRegistration(
            registrationEncoded,
            { challenge: encode(claim.jti), origin: origin }
          );

          const userId = jurisdiction.user.newUniqueId();

          const { success } = await insertUser(env.D1, {
            userId: userId.toString(),
            app,
            aliases,
          });
          if (!success) {
            return error(409, { message: "aliases_already_in_use" });
          }

          const user = $user(jurisdiction.user, userId);

          const response = await user.post("/occupy", {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, app, aliases }),
          });
          if (!response.ok) {
            return error(403, { message: "user_exists" });
          }

          const passkeyId = jurisdiction.passkey.idFromName(
            registrationParsed.credential.id
          );

          const postUpdate = async () => {
            const credential = registrationEncoded.credential;
            const credentialId = credential.id;

            return Promise.all([
              cacheAliases(env.KV_ALIAS, {
                app,
                userId: userId.toString(),
                aliases,
              }),
              linkPasskey(jurisdiction.user, userId, {
                app,
                passkeyId,
                credentialId,
              }),
              createPasskey(jurisdiction.passkey, passkeyId, {
                app,
                visitor: claim.vis,
                userId: userId.toString(),
                credential,
              }),
            ]);
          };

          ctx.waitUntil(postUpdate());

          return ok(201, {
            userId: userId.toString(),
            passkeyId: passkeyId.toString(),
          });
        } catch {
          return error(403, { message: "passkey_invalid" });
        }
      } catch (err) {
        if (err instanceof Error) console.error(err.message);
        throw err;
      }
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
        aliases.map((alias) =>
          env.KV_ALIAS.get(kvAlias(app, alias)).then(
            (result) => [alias, result !== null] as const
          )
        )
      );
      return ok(200, { aliases: result });
    }
  )
  .get(
    "/server/aliases/:name",
    [server_],
    async ({ app, params: { name } }, env) => {
      const userId = await env.KV_ALIAS.get(kvAlias(app, name));
      return ok(200, { userId: userId ?? undefined });
    }
  )
  .get(
    "/server/users/:userId/passkeys",
    [server_],
    async ({ app, params: { userId } }, env) => {
      try {
        const passkeys = await getListPasskeyFromCache(env.KV_PASSKEY, {
          app,
          userId,
        });

        return ok(200, { passkeys });
      } catch {
        return error(404, { message: "user_missing" });
      }
    }
  )
  .delete(
    "/server/users/:userId/passkeys/:passkeyId",
    [server_],
    async ({ app, params: { userId, passkeyId } }, env) => {
      try {
        const jurisdiction = {
          passkey: env.DO_PASSKEY.jurisdiction("eu"),
          user: env.DO_USER.jurisdiction("eu"),
        };

        const user = $user(jurisdiction.user, userId);
        const response = await user.delete("/remove-passkey/:passkeyId", {
          headers: { Authorization: app },
        });

        if (!response.ok) {
          return error(404, { message: "passkey_not_found" });
        }

        const passkey = $passkey(jurisdiction.passkey, passkeyId);
        await passkey.delete("/implode", { headers: { Authorization: app } });

        return empty(204);
      } catch {
        throw error(500, { message: "internal_error" });
      }
    }
  )
  .post(
    "/server/actions/send-code",
    [server_, data_(type({ alias: "string" }))],
    async ({ data: { alias }, app }, env, ctx) => {
      const jurisdiction = env.DO_USER.jurisdiction("eu");
      const code = generateCode(8);

      const userId = await env.KV_ALIAS.get(kvAlias(app, alias));
      if (userId === null) {
        return error(404, { message: "user_missing" });
      }

      const response = await $user(jurisdiction, userId).get("/recovery", {
        headers: { Authorization: app },
      });
      if (!response.ok) {
        console.log("Alias didn't result in a proper user for some reason");
        return error(404, { message: "user_missing" });
      }

      const recovery = await response.json();
      if (!recovery.email) {
        return error(400, { message: "email_missing" });
      }

      const body = createBody({
        email: recovery.email.address,
        username: alias,
        dkim: env.DKIM_PRIVATE_KEY,
        code,
      });

      const challengeId = env.DO_CHALLENGE.newUniqueId();

      const minute30 = 1000 * 60 * 30;

      const postSend = async () => {
        await Promise.all([
          sendEmail(env.API_URL_MAILCHANNELS, body),
          $challenge(env.DO_CHALLENGE, challengeId).post(
            `/start?ms=${minute30}`,
            { body: code }
          ),
        ]);
      };

      ctx.waitUntil(postSend());

      const claim = encodeJwt(env.SECRET_FOR_PASSKEY, {
        jti: challengeId.toString(),
        sub: userId,
        exp: jwtTime(new Date(Date.now() + minute30)),
        aud: app,
      });

      return ok(202, { token: claim });
    }
  )
  .post(
    "/server/actions/verify-code",
    [server_, data_(type({ token: "string", code: "string" }))],
    async ({ data: { token, code }, app }, env) => {
      const { message, claim } = await parseClaim(
        env.SECRET_FOR_PASSKEY,
        app,
        token
      );
      if (message) {
        return error(403, message);
      }

      const passed = await finishChallenge(env.DO_CHALLENGE, claim.jti, code);
      if (!passed) {
        return error(403, { message: "challenge_expired" });
      }

      return empty(204);
    }
  )
  .post(
    "/server/actions/verify-passkey",
    [server_, data_(type({ token: "string", origin: "string" }))],
    async ({ app, data }, env, ctx) => {
      const jurisdiction = env.DO_PASSKEY.jurisdiction("eu");
      const { signinEncoded, claim, message } = await parseSigninToken(
        app,
        data.token,
        env.SECRET_FOR_PASSKEY
      );
      if (message === "token_invalid") {
        return error(401, "token_invalid");
      } else if (message) {
        return error(403, message);
      }

      const [passed, passkey] = await Promise.all([
        finishChallenge(env.DO_CHALLENGE, claim.jti),
        getPasskeyFromCache(env.KV_PASSKEY, {
          app,
          credentialId: signinEncoded.credentialId,
        }),
      ]);

      if (!passed) {
        return error(410, { message: "challenge_expired" });
      }
      if (!passkey) {
        return error(403, { message: "passkey_invalid" });
      }

      try {
        const signinParsed = await server.verifyAuthentication(
          signinEncoded,
          passkey.credential,
          {
            challenge: encode(claim.jti),
            origin: data.origin,
            counter: passkey.metadata.counter,
            userVerified: true,
          }
        );

        ctx.waitUntil(
          updatePasskey(
            jurisdiction,
            jurisdiction.idFromString(passkey.metadata.passkeyId),
            {
              counter: signinParsed.authenticator.counter,
              app,
              visitor: claim.vis,
            }
          )
        );

        return ok(200, {
          userId: passkey.metadata.userId,
          passkeyId: passkey.metadata.passkeyId,
        });
      } catch (e) {
        if (e instanceof Error) console.log(e);
        return error(403, { message: "passkey_invalid" });
      }
    }
  )
  .post(
    "/server/users/:userId/passkeys",
    [server_, data_(type({ token: "string", origin: "string" }))],
    async ({ app, params: { userId }, data: { token, origin } }, env, ctx) => {
      const jurisdiction = env.DO_PASSKEY.jurisdiction("eu");
      const { registrationEncoded, claim, message } =
        await parseRegistrationToken(app, token, env.SECRET_FOR_PASSKEY);
      if (message === "token_invalid") {
        return error(401, "token_invalid");
      } else if (message) {
        return error(403, message);
      }

      try {
        const passed = await finishChallenge(env.DO_CHALLENGE, claim.jti);
        if (!passed) {
          return error(410, { message: "challenge_expired" });
        }

        const registrationParsed = await server.verifyRegistration(
          registrationEncoded,
          { challenge: encode(claim.jti), origin }
        );

        const passkeyId = jurisdiction.idFromName(
          registrationEncoded.credential.id
        );

        ctx.waitUntil(
          createPasskey(jurisdiction, passkeyId, {
            app,
            visitor: claim.vis,
            userId,
            credential: registrationParsed.credential,
          })
        );

        return ok(201, {
          userId,
          passkeyId: passkeyId.toString(),
        });
      } catch (e) {
        return error(403, { message: "credential_invalid" });
      }
    }
  )
  .post(
    "/client/challenge-passkey",
    [client_],
    async ({ request, app }, env, ctx) => {
      const id = env.DO_CHALLENGE.newUniqueId();

      const claim = {
        jti: id.toString(),
        sub: "unknown",
        exp: jwtTime(minute1()),
        vis: makeVisitor(request),
        aud: app,
      };

      const token = await encodeJwt<ClientJwt>(env.SECRET_FOR_PASSKEY, claim);

      ctx.waitUntil($challenge(env.DO_CHALLENGE, id).post("/start"));

      return ok(200, { token }, { headers: cors(request) });
    }
  )
  .all("/*", [], () => {
    return new Response("Not found", { status: 404 });
  });

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

const parseSigninToken = async (app: string, token: string, secret: string) => {
  const [tokenRaw, signinRaw] = token.split("#");
  const { claim, message } = await parseClaim(secret, app, tokenRaw);
  if (!claim) {
    return { message };
  }

  const { data: signinEncoded, problems } = parseAuthenticationEncoded(
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
  const [tokenRaw, registrationRaw] = token.split("#");
  const { claim, message } = await parseClaim(secret, app, tokenRaw);
  if (!claim) {
    return { message } as const;
  }

  const { data: registrationEncoded, problems } = parseRegistrationEncoded(
    JSON.parse(decode(registrationRaw))
  );
  if (problems) {
    return { message: "token_invalid" } as const;
  }

  return { registrationEncoded, claim };
};

const cors = (request: Request) => ({
  "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "",
  "Access-Control-Allow-Method": "POST",
  "Access-Control-Allow-Headers": "Content-Type",
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
  {
    app,
    aliases,
    userId,
  }: {
    app: string;
    aliases: string[];
    userId: string;
  }
) => {
  const insertUser = db.prepare(
    "INSERT INTO user (id, created_at) VALUES (?, ?)"
  );
  const insertAlias = db.prepare(
    "INSERT INTO alias (name, created_at, app_id, user_id) VALUES (?, ?, ?, ?)"
  );

  const statements = [insertUser.bind(userId, now())];
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

const minute1 = () => fromNow(1000 * 60);

const fromNow = (ms: number) => {
  return new Date(new Date().getTime() + ms);
};

const parseClaim = async (secret: string, aud: string, token: string) => {
  const claim = await decodeJwt<ClientJwt>(secret, token);
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

const finishChallenge = async (
  namespace: DurableObjectNamespace,
  id: string,
  code?: string
) => {
  const response = await $challenge(namespace, id).post("/finish", {
    body: code,
  });
  return response.ok;
};

const createPasskey = async (
  namespace: DurableObjectNamespace,
  passkeyId: DurableObjectId,
  data: {
    userId: string;
    app: string;
    credential: Credential;
    visitor: Visitor;
  }
) => {
  const passkey = $passkey(namespace, passkeyId);

  await passkey.post("/occupy", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};

const linkPasskey = async (
  namespace: DurableObjectNamespace,
  userId: DurableObjectId,
  {
    app,
    passkeyId,
    credentialId,
  }: {
    app: string;
    passkeyId: DurableObjectId;
    credentialId: string;
  }
) => {
  const user = $user(namespace, userId);

  await user.post("/add-passkey", {
    headers: { "Content-Type": "application/json", Authorization: app },
    body: JSON.stringify({
      passkeyId: passkeyId.toString(),
      credentialId,
    }),
  });
};

const updatePasskey = async (
  namespace: DurableObjectNamespace,
  passkeyId: DurableObjectId,
  { app, counter, visitor }: { app: string; counter: number; visitor: Visitor }
) => {
  const passkey = $passkey(namespace, passkeyId);
  await passkey.post("/used", {
    headers: { "Content-Type": "application/json", Authorization: app },
    body: JSON.stringify({ counter, visitor }),
  });
};

const cacheAliases = async (
  namespace: KVNamespace,
  { app, userId, aliases }: { app: string; userId: string; aliases: string[] }
) => {
  return await Promise.all(
    aliases.map((alias) =>
      namespace.put(kvAlias(app, alias), userId, {
        metadata: { userId, createdAt: now() },
      })
    )
  );
};

const kvAlias = (app: string, alias: string) =>
  `#app#${app}#alias#${encode(alias)}`;

const makeVisitor = (request: Request) => {
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
  };
};

type ClientJwt = { vis: Visitor };
