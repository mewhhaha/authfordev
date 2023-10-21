import { Plugin, PluginContext, Router } from "@mewhhaha/little-router";
import { empty, error, ok } from "@mewhhaha/typed-response";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { type } from "arktype";
import { decodeHeader } from "@internal/keys";

import { Env } from "./helpers/env";
import { encode, encodeJwt, jwtTime } from "@internal/jwt";
import { server } from "@passwordless-id/webauthn";
import {
  Credential,
  parsedBoolean,
  parseClaim,
  parseAuthenticationToken,
  parseRegistrationToken,
} from "./helpers/parser";
import { $challenge } from "./challenge";
import { $user, GuardUser, PasskeyLink } from "./user";
import {
  $passkey,
  Visitor,
  makeVisitor,
  Metadata as PasskeyMetadata,
  GuardPasskey,
} from "./passkey";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { createBody, sendEmail } from "./helpers/email";
import { insertUser } from "./helpers/d1";
import { minute1, now } from "./helpers/time";

export { DurableObjectUser } from "./user";
export { DurableObjectChallenge } from "./challenge";
export { DurableObjectPasskey } from "./passkey";

type CachedPasskey = {
  userId: string;
  passkeyId: string;
  counter: number;
  credential: Credential;
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
  .get(
    "/server/aliases/:name",
    [server_],
    async ({ app, params: { name } }, env) => {
      const userId = await env.KV_ALIAS.get(kvAlias(app, name));
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
        await verifyRegistration(token, { app, env, origin });
      if (message) {
        return error(403, { message });
      }

      const userId = jurisdiction.user.newUniqueId();

      const { success } = await insertUser(env.D1, {
        userId: `${userId}`,
        app,
        aliases,
      });
      if (!success) {
        return error(409, { message: "aliases_taken" });
      }

      const user = $user(jurisdiction.user, userId);

      const passkeyLink = makePasskeyLink({ passkeyId, credential, userId });
      const response = await user.post("/occupy", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, app, aliases, passkey: passkeyLink }),
      });
      if (!response.ok) {
        return error(403, { message: "user_exists" });
      }

      const postUpdate = async () => {
        const passkey = $passkey(jurisdiction.passkey, passkeyId);

        await Promise.all([
          cacheAliases(env.KV_ALIAS, { app, userId, aliases }),
          cacheNewPasskey(env.KV_PASSKEY, { app, passkeyLink, credential }),
          createPasskey(passkey, { app, visitor, userId, credential }),
        ]);
      };

      ctx.waitUntil(postUpdate());

      return ok(201, {
        userId: `${userId}`,
        passkeyId: `${passkeyId}`,
      });
    }
  )
  .post(
    "/server/users/:userId/passkeys",
    [
      server_,
      data_(
        type({
          token: "string",
          origin: "string",
        })
      ),
    ],
    async (
      { app, params: { userId: userIdString }, data: { token, origin } },
      env
    ) => {
      const jurisdiction = {
        user: env.DO_USER.jurisdiction("eu"),
        passkey: env.DO_PASSKEY.jurisdiction("eu"),
      };

      const { message, passkeyId, credential, visitor } =
        await verifyRegistration(token, { app, origin, env });
      if (message) {
        return error(403, { message });
      }

      const userId = jurisdiction.user.idFromString(userIdString);
      const user = $user(jurisdiction.user, userId);
      const passkeyLink = makePasskeyLink({ passkeyId, credential, userId });
      const guard = guardUser(app);
      const linked = await linkPasskey(user, { passkeyLink, guard });
      if (!linked) {
        return error(404, { message: "user_missing" });
      }

      const passkey = $passkey(jurisdiction.passkey, passkeyId);
      const creationData = { app, visitor, userId, credential };
      await Promise.all([
        createPasskey(passkey, creationData),
        cacheNewPasskey(env.KV_PASSKEY, { app, passkeyLink, credential }),
      ]);

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
      const response = await passkey.get(`/data?visitors=${visitors}`, {
        headers: { Authorization: guard },
      });

      if (!response.ok) {
        return error(404, "passkey_missing");
      }

      return response;
    }
  )
  .get(
    "/server/users/:userId/passkeys",
    [server_],
    async ({ app, params: { userId: userIdString } }, env, ctx) => {
      const passkeys = await env.KV_PASSKEY.get<PasskeyLink[]>(
        makeKvKeyPasskeys(app, userIdString),
        "json"
      );

      return ok(200, { passkeys: passkeys ?? [] });
    }
  )
  .get(
    "/server/users/:userId",
    [server_, query_(type({ "recovery?": parsedBoolean }))],
    async (
      { app, query: { recovery = false }, params: { userId: userIdString } },
      env
    ) => {
      const jurisdiction = env.DO_USER.jurisdiction("eu");
      const user = $user(jurisdiction, userIdString);
      const response = await user.get(`/data?recovery=${recovery}`, {
        headers: { Authorization: guardUser(app) },
      });

      if (!response.ok) {
        return error(404, { message: "user_missing" });
      }

      return response;
    }
  )
  .delete(
    "/server/users/:userId/passkeys/:passkeyId",
    [server_],
    async ({ app, params: { userId, passkeyId } }, env, ctx) => {
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

      if (!removedLink || !removedPasskey) {
        return error(404, { message: "passkey_missing" });
      }

      const postDelete = async () => {
        await cacheRemovedPasskey(env.KV_PASSKEY, {
          app,
          userId,
          credentialId: removedPasskey.metadata.credentialId,
          passkeyLinks: removedLink.passkeys,
        });
      };

      ctx.waitUntil(postDelete());

      return ok(200, removedPasskey);
    }
  )
  .put(
    "/server/users/:userId/rename-passkey/:passkeyId",
    [server_, data_(type({ name: "string" }))],
    async ({ app, data, params: { userId, passkeyId } }, env, ctx) => {
      const jurisdiction = {
        passkey: env.DO_PASSKEY.jurisdiction("eu"),
        user: env.DO_USER.jurisdiction("eu"),
      };

      const user = $user(jurisdiction.user, userId);
      const response = await user.put(`/rename-passkey/${passkeyId}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: guardUser(app),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        return error(404, { message: "passkey_missing" });
      }

      const postRename = async () => {
        const { passkeys } = await response.json();
        const kvKey = makeKvKeyPasskeys(app, userId);
        await cacheUpdatedPasskeys(env.KV_PASSKEY, kvKey, passkeys);
      };

      ctx.waitUntil(postRename());

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
        aliases.map((alias) =>
          env.KV_ALIAS.get(kvAlias(app, alias)).then(
            (result) => [alias, result !== null] as const
          )
        )
      );
      return ok(200, { aliases: result });
    }
  )
  .post(
    "/server/actions/send-code",
    [server_, data_(type({ alias: "string", "email?": "email" }))],
    async ({ data: { alias, email: specifiedAdress }, app }, env, ctx) => {
      const jurisdiction = env.DO_USER.jurisdiction("eu");
      const code = generateCode(8);

      const userId = await env.KV_ALIAS.get(kvAlias(app, alias));
      if (userId === null) {
        return error(404, { message: "user_missing" });
      }

      const response = await $user(jurisdiction, userId).get(
        "/data?recovery=true",
        { headers: { Authorization: guardUser(app) } }
      );
      if (!response.ok) {
        console.log("Alias didn't result in a proper user for some reason");
        return error(404, { message: "user_missing" });
      }

      const { recovery } = await response.json();
      if (!recovery) {
        throw new Error("Recovery was undefined when it should always exist");
      }

      const address = recovery.emails.find((e) =>
        specifiedAdress ? e.address === specifiedAdress : e.primary
      )?.address;

      if (!address) {
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
          startChallenge(challenge, { ms: minute30, code }),
        ]);
      };

      ctx.waitUntil(postSend());

      const claim = encodeJwt(env.SECRET_FOR_PASSKEY, {
        jti: `${challengeId}`,
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

      const challenge = $challenge(env.DO_CHALLENGE, claim.jti);
      const passed = await finishChallenge(challenge, code);
      if (!passed) {
        return error(403, { message: "challenge_expired" });
      }

      return empty(204);
    }
  )
  .post(
    "/server/actions/verify-passkey",
    [server_, data_(type({ token: "string", origin: "string" }))],
    async ({ app, data: { origin, token } }, env, ctx) => {
      const jurisdiction = env.DO_PASSKEY.jurisdiction("eu");
      const { authentication, challengeId, visitor, message } =
        await parseAuthenticationToken(token, {
          app,
          secret: env.SECRET_FOR_PASSKEY,
        });
      if (message === "token_invalid") {
        return error(401, "token_invalid");
      } else if (message) {
        return error(403, message);
      }

      const passkeyId = jurisdiction.idFromName(authentication.credentialId);
      const kvKeyPasskey = makeKvKeyPasskey(app, authentication.credentialId);
      const challenge = $challenge(env.DO_CHALLENGE, challengeId);
      const [passed, cached] = await Promise.all([
        finishChallenge(challenge),
        env.KV_PASSKEY.get<CachedPasskey>(kvKeyPasskey, "json"),
      ]);

      if (!passed) {
        return error(410, { message: "challenge_expired" });
      }

      if (!cached) {
        return error(403, { message: "passkey_invalid" });
      }

      try {
        const { authenticator } = await server.verifyAuthentication(
          authentication,
          cached.credential,
          {
            origin,
            challenge: encode(challengeId),
            counter: cached.counter,
            userVerified: true,
          }
        );

        const postVerification = async () => {
          const passkey = $passkey(jurisdiction, passkeyId);
          const guard = guardPasskey(app, cached.userId);
          const counter = authenticator.counter || -1;
          const data = { guard, visitor, counter };
          const visitPromise = visitPasskey(passkey, data);

          const updated = { ...cached, counter };
          const cachePromise = cacheUpdatedPasskey(
            env.KV_PASSKEY,
            kvKeyPasskey,
            updated
          );

          await Promise.all([visitPromise, cachePromise]);
        };

        ctx.waitUntil(postVerification());

        return ok(200, {
          userId: cached.userId,
          passkeyId: cached.passkeyId,
        });
      } catch (err) {
        console.error(err);
        return error(403, { message: "authentication_failed" });
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

      const token = await encodeJwt<{ vis: Visitor }>(
        env.SECRET_FOR_PASSKEY,
        claim
      );

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
  const response = await challenge.post("/finish", {
    body: code,
  });
  return response.ok;
};

const startChallenge = async (
  challenge: ReturnType<typeof $challenge>,
  { ms, code }: { ms?: number; code?: string }
) => {
  return challenge.post(`/start?ms=${ms}`, { body: code });
};

const createPasskey = async (
  passkey: ReturnType<typeof $passkey>,
  data: {
    userId: DurableObjectId | string;
    app: string;
    credential: Credential;
    visitor: Visitor;
  }
) => {
  const response = await passkey.post("/occupy", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, userId: `${data.userId}` }),
  });

  return response.ok;
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
  const response = await user.post("/link-passkey", {
    headers: { "Content-Type": "application/json", Authorization: guard },
    body: JSON.stringify(passkeyLink),
  });

  return response.ok;
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
  const response = await user.delete(`/remove-passkey/${passkeyId}`, {
    headers: { Authorization: guard },
  });

  if (!response.ok) {
    return undefined;
  }

  return await response.json();
};

const removePasskey = async (
  passkey: ReturnType<typeof $passkey>,
  { guard }: { guard: GuardPasskey }
) => {
  const response = await passkey.delete("/implode", {
    headers: { Authorization: guard },
  });

  if (!response.ok) {
    return undefined;
  }
  return await response.json();
};

const kvAlias = (app: string, alias: string) =>
  `#app#${app}#alias#${encode(alias)}`;

const cacheAliases = async (
  namespace: KVNamespace,
  {
    app,
    userId: userIdAny,
    aliases,
  }: { app: string; userId: DurableObjectId | string; aliases: string[] }
) => {
  const userId = `${userIdAny}`;

  return await Promise.all(
    aliases.map((alias) =>
      namespace.put(kvAlias(app, alias), userId, {
        metadata: { userId, createdAt: now() },
      })
    )
  );
};

const cacheNewPasskey = async (
  namespace: KVNamespace,
  {
    app,
    passkeyLink,
    credential,
  }: {
    app: string;
    passkeyLink: PasskeyLink;
    credential: Credential;
  }
) => {
  const single = namespace.put(
    makeKvKeyPasskey(app, credential.id),
    JSON.stringify<CachedPasskey>({
      counter: -1,
      userId: passkeyLink.userId,
      passkeyId: passkeyLink.passkeyId,
      credential,
    })
  );

  const list = namespace.put(
    makeKvKeyPasskeys(app, passkeyLink.userId),
    JSON.stringify([passkeyLink])
  );

  await Promise.all([single, list]);
};

const cacheRemovedPasskey = async (
  namespace: KVNamespace,
  {
    app,
    credentialId,
    userId,
    passkeyLinks,
  }: {
    app: string;
    credentialId: string;
    userId: string;
    passkeyLinks: PasskeyLink[];
  }
) => {
  const single = namespace.delete(makeKvKeyPasskey(app, credentialId));

  const list = namespace.put(
    makeKvKeyPasskeys(app, userId),
    JSON.stringify(passkeyLinks)
  );

  await Promise.all([single, list]);
};

const cacheUpdatedPasskey = async (
  namespace: KVNamespace,
  cacheKey: KvKeyPasskey,
  data: CachedPasskey
) => {
  await namespace.put(cacheKey, JSON.stringify(data));
};

const cacheUpdatedPasskeys = async (
  namespace: KVNamespace,
  cacheKey: KvKeyPasskeys,
  data: PasskeyLink[]
) => {
  await namespace.put(cacheKey, JSON.stringify(data));
};

const verifyRegistration = async (
  token: string,
  { app, env, origin }: { app: string; origin: string; env: Env }
) => {
  const jurisdiction = env.DO_PASSKEY.jurisdiction("eu");
  try {
    const { registrationEncoded, claim, message } =
      await parseRegistrationToken(token, {
        app,
        secret: env.SECRET_FOR_PASSKEY,
      });
    if (message) {
      return { message } as const;
    }

    const challenge = $challenge(env.DO_CHALLENGE, claim.jti);
    const passed = await finishChallenge(challenge);
    if (!passed) {
      return { message: "challenge_expired" } as const;
    }

    const registrationParsed = await server.verifyRegistration(
      registrationEncoded,
      { challenge: encode(claim.jti), origin }
    );

    const credential = registrationParsed.credential;
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

const makeKvKeyPasskey = (app: string, credentialId: string) => {
  return `#app#${app}#credentialId#${credentialId}` as const;
};

type KvKeyPasskey = ReturnType<typeof makeKvKeyPasskey>;

const makeKvKeyPasskeys = (app: string, userId: string) => {
  return `#app#${app}#userId#${userId}` as const;
};

type KvKeyPasskeys = ReturnType<typeof makeKvKeyPasskeys>;

const visitPasskey = (
  passkey: ReturnType<typeof $passkey>,
  {
    guard,
    visitor,
    counter,
  }: { guard: GuardPasskey; visitor: Visitor; counter: number }
) => {
  return passkey.put("/visit", {
    headers: {
      "Content-Type": "application/json",
      Authorization: guard,
    },
    body: JSON.stringify({ visitor, counter }),
  });
};

const guardPasskey = (app: string, userId: DurableObjectId | string) => {
  return `passkey:${app}:${userId}` as const;
};

const guardUser = (app: string) => {
  return `user:${app}` as const;
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
  const passkeyIdString = `${passkeyId}`;
  return {
    passkeyId: passkeyIdString,
    credentialId: credential.id,
    userId: `${userId}`,
    name: `passkey-${passkeyIdString.slice(0, 3) + passkeyIdString.slice(-3)}`,
  };
};
