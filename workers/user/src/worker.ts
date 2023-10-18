import { Plugin, PluginContext, Router } from "@mewhhaha/little-router";
import { BodySend, mailChannels } from "./api/mail-channels";
import { empty, error, ok } from "@mewhhaha/typed-response";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { type } from "arktype";
import { decodeHeader } from "@internal/keys";
import emailSendCode from "@internal/emails/dist/send-code.json";
import { $user } from "./user";
import { Env } from "./env";
import { decode, decodeJwt, encode, encodeJwt, jwtTime } from "@internal/jwt";
import { server } from "@passwordless-id/webauthn";
import {
  Credential,
  parseRegistrationEncoded,
  parseSigninEncoded,
} from "./parsers";
import { hmac } from "./helpers";
import { $challenge } from "./challenge";

export { DurableObjectUser } from "./user";
export { DurableObjectChallenge } from "./challenge";

type PasskeyMetadata = {
  userId: string;
  createdAt: string;
  lastUsedAt: string;
  country: string;
  counter: number;
  app: string;
};

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

const client_ = (async ({ params }: PluginContext, env: Env) => {
  const clientKey = decodeURIComponent(params.clientKey);

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
    "/server/new-user",
    [
      server_,
      data_(
        type({
          aliases: "1<(string<60)[]<4",
          "email?": "string",
          token: "string",
        })
      ),
    ],
    async ({ app, data: { email, aliases } }, env, ctx) => {
      const jurisdiction = env.DO_USER.jurisdiction("eu");
      const userId = jurisdiction.newUniqueId().toString();

      const { success } = await insertUser(env.D1, {
        userId,
        app,
        aliases,
      });
      if (!success) {
        return error(409, { message: "aliases_already_in_use" });
      }

      const user = $user(jurisdiction, userId);

      ctx.waitUntil(postUpdateAliases(env.KV_ALIAS, { app, aliases, userId }));

      const response = await user.post("/occupy", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, app, aliases }),
      });
      if (!response.ok) {
        return error(403, { message: "user_exists" });
      }

      return ok(201, { userId });
    }
  )

  .post(
    "/server/challenge-user",
    [
      server_,
      data_(
        type({
          aliases: "1<(string<60)[]<4",
        })
      ),
    ],
    async ({ app, data: { aliases } }, env, ctx) => {
      const result = await Promise.all(
        aliases.map((alias) => env.KV_ALIAS.get(kvAlias(app, alias)))
      );
      if (result.some((u) => u !== null)) {
        return error(409, { message: "aliases_already_in_use" });
      }

      const jurisdiction = env.DO_USER.jurisdiction("eu");
      const userId = jurisdiction.newUniqueId();
      const id = env.DO_CHALLENGE.newUniqueId();

      const hour1 = 1000 * 60 * 60;

      ctx.waitUntil(
        $challenge(env.DO_CHALLENGE, id).post(`/start?ms=${hour1}`)
      );

      const claim = {
        jti: id.toString(),
        sub: userId.toString(),
        exp: jwtTime(new Date(Date.now() + hour1)),
        aud: app,
      };
      const token = await encodeJwt(env.SECRET_FOR_REGISTER, claim);

      return ok(200, { token });
    }
  )
  .post(
    "/server/challenge-passkey",
    [
      server_,
      data_(
        type({
          alias: "string",
        })
      ),
    ],
    async ({ app, data: { alias } }, env, ctx) => {
      const userId = await env.KV_ALIAS.get(kvAlias(app, alias), "text");
      if (userId === null) {
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

      const id = env.DO_CHALLENGE.newUniqueId();

      const hour1 = 1000 * 60 * 60;

      ctx.waitUntil(
        $challenge(env.DO_CHALLENGE, id).post(`/start?ms=${hour1}`)
      );

      const claim = {
        jti: id.toString(),
        sub: userId,
        exp: jwtTime(new Date(Date.now() + hour1)),
        aud: app,
      };
      const token = await encodeJwt(env.SECRET_FOR_REGISTER, claim);

      return ok(200, { token });
    }
  )
  .post(
    "/server/list-passkeys",
    [server_, data_(type({ userId: "string" }))],
    async ({ app, data }, env) => {
      try {
        const passkeys = await env.KV_PASSKEY.list<PasskeyMetadata>({
          prefix: kvListPasskeyPrefix(app, data.userId),
        });

        return ok(200, {
          passkeys: passkeys.keys.map((k) => k.metadata as PasskeyMetadata),
        });
      } catch {
        return error(404, { message: "user_missing" });
      }
    }
  )
  .post(
    "/server/delete-passkey",
    [server_, data_(type({ userId: "string", credentialId: "string" }))],
    async ({ app, data }, env) => {
      try {
        const passkey = await deletePasskey(env.KV_PASSKEY, { app, ...data });
        return ok(200, { passkey });
      } catch {
        throw error(500, { message: "internal_error" });
      }
    }
  )
  .post(
    "/server/send-code",
    [server_, data_(type({ alias: "string" }))],
    async ({ data: { alias }, app }, env, ctx) => {
      const code = generateCode(8);

      const userId = await env.KV_ALIAS.get(kvAlias(app, alias));
      if (userId === null) {
        return error(404, { message: "user_missing" });
      }

      const response = await $user(env.DO_USER, userId).get("/recovery", {
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

      const claim = encodeJwt(env.SECRET_FOR_REGISTER, {
        jti: challengeId.toString(),
        sub: userId,
        exp: jwtTime(new Date(Date.now() + minute30)),
        aud: app,
      });

      return ok(202, { token: claim });
    }
  )
  .post(
    "/server/verify-code",
    [server_, data_(type({ token: "string", code: "string" }))],
    async ({ data: { token, code }, app }, env) => {
      const { message, claim } = await parseClaim(
        env.SECRET_FOR_REGISTER,
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

      return ok(200, { userId: claim.sub });
    }
  )
  .post(
    "/server/verify-passkey",
    [server_, data_(type({ token: "string", origin: "string" }))],
    async ({ app, data }, env, ctx) => {
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

      const kvKeyPasskey = kvSinglePasskey(app, signinEncoded.credentialId);

      const [passed, passkey] = await Promise.all([
        finishChallenge(env.DO_CHALLENGE, claim.jti),
        retrievePasskey(env.KV_PASSKEY, kvKeyPasskey),
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
            counter: passkey.meta.counter,
            userVerified: true,
          }
        );

        ctx.waitUntil(
          postUpdatePasskey(
            env.KV_PASSKEY,
            passkey,
            signinParsed.authenticator.counter
          )
        );

        return ok(200, {
          userId: passkey.meta.userId,
          credentialId: passkey.credential.id,
        });
      } catch (e) {
        if (e instanceof Error) console.log(e);
        return error(403, { message: "passkey_invalid" });
      }
    }
  )
  .post(
    "/server/new-passkey",
    [server_, data_(type({ token: "string", origin: "string" }))],
    async ({ app, request, data }, env, ctx) => {
      const { registrationEncoded, claim, message } =
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

        const passed = await finishChallenge(env.DO_CHALLENGE, claim.jti);
        if (!passed) {
          return error(410, { message: "challenge_expired" });
        }

        ctx.waitUntil(
          postUpdatePasskey(env.KV_PASSKEY, {
            credential: registrationEncoded.credential,
            meta: {
              app,
              country,
              createdAt: now(),
              lastUsedAt: now(),
              userId: claim.sub,
              counter: -1,
            },
          })
        );

        return ok(200, {
          userId: claim.sub,
          credentialId: registrationParsed.credential.id,
        });
      } catch (e) {
        return error(403, { message: "credential_invalid" });
      }
    }
  )
  // .options("/client/signin-device", [], ({ request }) => {
  //   return new Response(undefined, {
  //     status: 204,
  //     headers: cors(request),
  //   });
  // })
  .post(
    "/client/:clientKey/challenge-signin",
    [client_],
    async ({ app }, env, ctx) => {
      const id = env.DO_CHALLENGE.newUniqueId();

      const claim = {
        jti: id.toString(),
        sub: "discoverable",
        exp: jwtTime(minute1()),
        aud: app,
      };

      const token = await encodeJwt(env.SECRET_FOR_SIGNIN, claim);

      ctx.waitUntil($challenge(env.DO_CHALLENGE, id).post("/start"));

      return ok(200, { token });
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

const now = () => new Date().toISOString();

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

const retrievePasskey = async (namespace: KVNamespace, key: string) => {
  const passkey = await namespace.getWithMetadata<Credential, PasskeyMetadata>(
    key,
    "json"
  );

  if (passkey.metadata === null || passkey.value === null) return undefined;

  return {
    credential: passkey.value,
    meta: passkey.metadata,
  };
};

const postUpdatePasskey = async (
  namespace: KVNamespace,
  passkey: { credential: Credential; meta: PasskeyMetadata },
  counter?: number
) => {
  const metadata = {
    ...passkey.meta,
    lastUsedAt: now(),
    counter: counter === 0 ? -1 : counter,
  };

  const credentialString = JSON.stringify(passkey.credential);

  const single = namespace.put(
    kvSinglePasskey(metadata.app, passkey.credential.id),
    credentialString,
    { metadata }
  );

  const list = namespace.put(
    kvListPasskey(metadata.app, metadata.userId, passkey.credential.id),
    "",
    { metadata }
  );

  return Promise.all([single, list]);
};

const postUpdateAliases = async (
  namespace: KVNamespace,
  { app, userId, aliases }: { app: string; userId: string; aliases: string[] }
) => {
  return await Promise.all(
    aliases.map((alias) =>
      namespace.put(kvAlias(app, alias), userId, {
        metadata: { userId },
      })
    )
  );
};

const deletePasskey = async (
  namespace: KVNamespace,
  {
    app,
    userId,
    credentialId,
  }: { app: string; userId: string; credentialId: string }
) => {
  const passkey = namespace.getWithMetadata<Credential, PasskeyMetadata>(
    kvSinglePasskey(app, credentialId),
    "json"
  );

  const single = namespace.delete(kvSinglePasskey(app, credentialId));
  const list = namespace.delete(kvListPasskey(app, userId, credentialId));

  await Promise.all([single, list]);

  const pk = await passkey;
  if (pk.metadata === null) {
    throw new Error("metadata was unexpectedly null when deleting passkey");
  }

  return { credential: pk.value, meta: pk.metadata };
};

const kvSinglePasskey = (app: string, passkeyId: string) =>
  `#app#${app}#id#${passkeyId}`;

const kvListPasskey = (app: string, userId: string, passKeyId: string) =>
  `#app#${app}#user#${userId}#id#${passKeyId}`;

const kvListPasskeyPrefix = (app: string, userId: string) =>
  `#app#${app}#user#${userId}#id#`;

const kvAlias = (app: string, alias: string) =>
  `#app#${app}#alias#${encode(alias)}`;
