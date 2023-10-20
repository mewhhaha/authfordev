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
  AuthenticationEncoded,
} from "./helpers/parser";
import { $challenge } from "./challenge";
import { $user } from "./user";
import {
  $passkey,
  Visitor,
  makeVisitor,
  Metadata as PasskeyMetadata,
} from "./passkey";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { createBody, sendEmail } from "./helpers/email";
import { insertUser } from "./helpers/d1";
import { minute1, now } from "./helpers/time";

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
        userId: userId.toString(),
        app,
        aliases,
      });
      if (!success) {
        return error(409, { message: "aliases_already_in_use" });
      }

      const user = $user(jurisdiction.user, userId);

      const passkeyLink = {
        passkeyId: passkeyId.toString(),
        credentialId: credential.id,
      };
      const response = await user.post("/occupy", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, app, aliases, passkey: passkeyLink }),
      });
      if (!response.ok) {
        return error(403, { message: "user_exists" });
      }

      const postUpdate = async () => {
        await Promise.all([
          cacheAliases(env.KV_ALIAS, { app, userId, aliases }),
          createPasskey(jurisdiction.passkey, passkeyId, {
            app,
            visitor,
            userId,
            credential,
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

      const linkedPromise = linkPasskey(jurisdiction.user, userId, {
        app,
        passkeyId,
        credentialId: credential.id,
      });

      const createdPromise = createPasskey(jurisdiction.passkey, passkeyId, {
        app,
        visitor,
        userId,
        credential,
      });

      const [linked, created] = await Promise.all([
        linkedPromise,
        createdPromise,
      ]);

      if (!created || !linked) {
        if (!created && linked) {
          removePasskeyLink(jurisdiction.user, userId, { app, passkeyId });
        }

        if (created && !linked) {
          const passkey = $passkey(jurisdiction.passkey, passkeyId);
          passkey.delete("/implode", {
            headers: { Authorization: `${app}:${userId}` },
          });
        }
        return error(401, { message: "passkey_not_created" });
      }

      return ok(201, {
        userId,
        passkeyId: passkeyId.toString(),
      });
    }
  )
  .get(
    "/server/users/:userId/passkeys/:passkeyId/visitors",
    [server_],
    async ({ app, params: { userId, passkeyId } }, env) => {
      const jurisdiction = env.DO_PASSKEY.jurisdiction("eu");
      const passkey = $passkey(jurisdiction, passkeyId);
      const response = await passkey.get("/visitors", {
        headers: { Authorization: `${app}:${userId}` },
      });
      if (!response.ok) {
        return error(404, { message: "passkey_missing" });
      }

      return response;
    }
  )
  .get(
    "/server/users/:userId/passkeys",
    [server_],
    async ({ request, app, params: { userId: userIdString } }, env, ctx) => {
      // const cache = await caches.open(`app:${app}`);

      // const cacheKey = new Request(request.url, {
      //   headers: { "Last-Modified": new Date().toUTCString() },
      // });
      const revalidate = async () => {
        const jurisdiction = {
          user: env.DO_USER.jurisdiction("eu"),
          passkey: env.DO_PASSKEY.jurisdiction("eu"),
        };

        const { message, passkeys } = await listPasskeys(jurisdiction, {
          app,
          userId: jurisdiction.user.idFromString(userIdString),
        });
        if (message) {
          return error(404, { message });
        }

        await env.KV_PASSKEY.put(
          kvKeyPasskeys(app, userIdString),
          JSON.stringify(passkeys)
        );

        return ok(200, { passkeys });
      };

      const passkeys = await env.KV_PASSKEY.get<PasskeyMetadata>(
        kvKeyPasskeys(app, userIdString),
        "json"
      );
      if (passkeys) {
        ctx.waitUntil(revalidate());
        return ok(200, { passkeys });
      }

      // const cached = await cache.match(cacheKey);
      // if (cached) {
      //   if (isStale(cached)) {
      //     ctx.waitUntil(revalidate());
      //   }

      //   return cached;
      // }

      return revalidate();
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
        headers: { Authorization: app },
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
    async ({ app, params: { userId, passkeyId } }, env) => {
      try {
        const jurisdiction = {
          passkey: env.DO_PASSKEY.jurisdiction("eu"),
          user: env.DO_USER.jurisdiction("eu"),
        };

        const removeLink = async () => {
          const user = $user(jurisdiction.user, userId);
          const response = await user.delete("/remove-passkey/:passkeyId", {
            headers: { Authorization: app },
          });

          return response.ok;
        };

        const removePasskey = async () => {
          const passkey = $passkey(jurisdiction.passkey, passkeyId);
          const response = await passkey.delete("/implode", {
            headers: { Authorization: `${app}:${userId}` },
          });
          return response.ok;
        };

        const [linkRemoved, passkeyRemoved] = await Promise.all([
          removeLink(),
          removePasskey(),
        ]);

        if (!linkRemoved && !passkeyRemoved) {
          return error(404, { message: "passkey_missing" });
        }

        return empty(204);
      } catch {
        throw error(500, { message: "internal_error" });
      }
    }
  )
  .put(
    "/server/users/:userId/passkeys/:passkeyId/rename",
    [server_, data_(type({ name: "string" }))],
    async ({ app, data, params: { userId, passkeyId } }, env) => {
      try {
        const jurisdiction = {
          passkey: env.DO_PASSKEY.jurisdiction("eu"),
          user: env.DO_USER.jurisdiction("eu"),
        };

        const passkey = $passkey(jurisdiction.passkey, passkeyId);
        const response = await passkey.put("/rename", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `${app}:${userId}`,
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          return error(404, { message: "passkey_missing" });
        }

        return ok(200, data);
      } catch {
        throw error(500, { message: "internal_error" });
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
        {
          headers: { Authorization: app },
        }
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
    async ({ app, data: { origin, token } }, env, ctx) => {
      const jurisdiction = env.DO_PASSKEY.jurisdiction("eu");
      const { authentication, challenge, visitor, message } =
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
      const data = { authentication, origin, challenge };

      const [passed, authenticated] = await Promise.all([
        finishChallenge(env.DO_CHALLENGE, challenge),
        authenticatePasskey(jurisdiction, passkeyId, { app, data }),
      ]);

      if (!passed) {
        return error(410, { message: "challenge_expired" });
      }

      if (!authenticated) {
        return error(403, { message: "passkey_invalid" });
      }

      const visitPasskey = () => {
        const passkey = $passkey(jurisdiction, passkeyId);
        return passkey.put("/visit", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `${app}:${authenticated.userId}`,
          },
          body: JSON.stringify({ visitor, counter: authenticated.counter }),
        });
      };

      ctx.waitUntil(visitPasskey());

      return ok(200, {
        userId: authenticated.userId,
        passkeyId: passkeyId.toString(),
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

const isStale = (response: Response) => {
  const lastModified = response.headers.get("Last-Modified") ?? 0;
  const difference = Date.now() - new Date(lastModified).getTime();
  const minute1 = 1000 * 60;
  return difference > minute1;
};

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
    userId: DurableObjectId;
    app: string;
    credential: Credential;
    visitor: Visitor;
  }
) => {
  const passkey = $passkey(namespace, passkeyId);

  const response = await passkey.post("/occupy", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, userId: data.userId.toString() }),
  });

  return response.ok;
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

  const response = await user.post("/link-passkey", {
    headers: { "Content-Type": "application/json", Authorization: app },
    body: JSON.stringify({
      passkeyId: passkeyId.toString(),
      credentialId,
    }),
  });

  return response.ok;
};

const removePasskeyLink = async (
  namespace: DurableObjectNamespace,
  userId: DurableObjectId,
  {
    app,
    passkeyId,
  }: {
    app: string;
    passkeyId: DurableObjectId;
  }
) => {
  const user = $user(namespace, userId);

  const response = await user.delete(`/remove-passkey/${passkeyId}`, {
    headers: { Authorization: app },
  });

  return response.ok;
};

const kvAlias = (app: string, alias: string) =>
  `#app#${app}#alias#${encode(alias)}`;

const cacheAliases = async (
  namespace: KVNamespace,
  {
    app,
    userId,
    aliases,
  }: { app: string; userId: DurableObjectId; aliases: string[] }
) => {
  const userIdString = userId.toString();

  return await Promise.all(
    aliases.map((alias) =>
      namespace.put(kvAlias(app, alias), userIdString, {
        metadata: { userId: userIdString, createdAt: now() },
      })
    )
  );
};

const listPasskeys = async (
  namsepaces: { user: DurableObjectNamespace; passkey: DurableObjectNamespace },
  { app, userId }: { app: string; userId: DurableObjectId }
) => {
  const getUser = async () => {
    const user = $user(namsepaces.user, userId);
    const response = await user.get("/data?passkeys=true", {
      headers: { Authorization: app },
    });
    if (!response.ok) {
      return undefined;
    }
    return await response.json();
  };

  const user = await getUser();
  if (!user?.passkeys) {
    return { message: "user_missing" } as const;
  }

  const loadPasskey = async ({ passkeyId }: { passkeyId: string }) => {
    const passkey = $passkey(namsepaces.passkey, passkeyId);
    const response = await passkey.get("/data", {
      headers: { Authorization: `${app}:${userId}` },
    });

    if (!response.ok) {
      return undefined;
    }

    const { metadata } = await response.json();
    return metadata;
  };

  const passkeys = await Promise.all(user.passkeys.map(loadPasskey));

  return {
    passkeys: passkeys.filter(
      (p): p is NonNullable<typeof p> => p !== undefined
    ),
  } as const;
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

    const passed = await finishChallenge(env.DO_CHALLENGE, claim.jti);
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

const authenticatePasskey = async (
  namespace: DurableObjectNamespace,
  passkeyId: DurableObjectId,
  {
    app,
    data,
  }: {
    app: string;
    data: {
      authentication: AuthenticationEncoded;
      origin: string;
      challenge: string;
    };
  }
) => {
  const passkey = $passkey(namespace, passkeyId);

  try {
    const response = await passkey.post("/authenticate", {
      headers: { "Content-Type": "application/json", Authorization: app },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      return undefined;
    }
    return await response.json();
  } catch {
    return undefined;
  }
};

const kvKeyPasskey = (app: string, credentialId: string) => {
  return `app#${app}#credentialId#${credentialId}}`;
};

const kvKeyPasskeys = (app: string, userId: string) => {
  return `app#${app}#userId#${userId}}`;
};
