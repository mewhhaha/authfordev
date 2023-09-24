import { Plugin, PluginContext, Router } from "@mewhhaha/little-router";
import { BodySend, mailChannels } from "./api/mail-channels";
import { error, ok } from "@mewhhaha/typed-response";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { type } from "arktype";
import { passwordless } from "./api/passwordless";

import { decodeHeader } from "@internal/keys";
import emailSendCode from "@internal/emails/dist/send-code.json";
import { $user } from "./user";
import { $webauthn } from "./webauthn";
import invariant from "invariant";

interface Env {
  API_URL_PASSWORDLESS: string;
  API_URL_MAILCHANNELS: string;
  SECRET_FOR_PRIVATE_KEY: string;
  SECRET_FOR_PUBLIC_KEY: string;
  D1: D1Database;
  DO_USER: DurableObjectNamespace;
  DO_WEBAUTHN: DurableObjectNamespace;
  DKIM_PRIVATE_KEY: string;
}

const private_ = (async (
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
    return error(403, { message: "authorization_header_missing" });
  }

  const app = await decodeHeader(env.SECRET_FOR_PRIVATE_KEY, "private", header);
  if (!app) {
    return error(403, { message: "authorization_header_invalid" });
  }

  return { app };
}) satisfies Plugin<[Env]>;

const router = Router<[Env, ExecutionContext]>()
  .post(
    "/register-user/email",
    [
      private_,
      data_(
        type({
          aliases: "string[]",
          email: "string",
        })
      ),
    ],
    async ({ app, data: { email, aliases } }, env, ctx) => {
      if (await areAliasesTaken(env.D1, app, aliases)) {
        return error(409, { message: "aliases_already_in_use" });
      }

      const jurisdiction = env.DO_WEBAUTHN.jurisdiction("eu");
      const user = $user(jurisdiction, jurisdiction.newUniqueId());

      user.post("/");

      const { session, code } = await createChallenge(jurisdiction);
      invariant(code, "unexpected empty code");

      const body = createBody({
        email,
        username: aliases[0] ?? email,
        code,
        dkim: env.DKIM_PRIVATE_KEY,
      });

      ctx.waitUntil(sendEmail(env.API_URL_MAILCHANNELS, body));

      return ok(200, { session, code });
    }
  )
  .post(
    "/register-device/email",
    [
      private_,
      data_(
        type({
          alias: "string",
        })
      ),
    ],
    async ({ app, data: { alias } }, env, ctx) => {
      const userId = await aliasedUserId(env.D1, app, alias);
      if (userId === null) {
        return error(404, { message: "user_missing" });
      }

      const user = $user(env.DO_USER, userId);

      const { email } = await user.get("/email").then((r) => r.json());

      const jurisdiction = env.DO_WEBAUTHN.jurisdiction("eu");
      const { session, code } = await createChallenge(jurisdiction);
      invariant(code, "unexpected empty code");

      const body = createBody({
        email,
        username: alias,
        code,
        dkim: env.DKIM_PRIVATE_KEY,
      });

      ctx.waitUntil(sendEmail(env.API_URL_MAILCHANNELS, body));

      return ok(200, { session, code });
    }
  )
  .post(
    "/signin-verify",
    [private_, data_(type({ token: "string" }))],
    async ({ auth, data }, env) => {
      const api = passwordless(env.API_URL_PASSWORDLESS);
      const response = await api.post("/signin/verify", {
        headers: { "Content-Type": "application/json", ApiSecret: auth.pk },
        body: JSON.stringify({ token: data.token }),
      });

      const signin = await response.json();
      if (!signin.success) {
        return error(403, {
          message: "verification_failed",
          data: { ...signin, success: false },
        });
      }

      return ok(200, { ...signin, success: true });
    }
  )
  .post(
    "/webauthn/register/begin",
    [public_, data_(type({ token: "string" }))],
    async () => {
      return new Response();
    }
  )
  .post("/webauthn/register/complete", [], async () => {
    return new Response();
  })
  .post("/webauthn/signin/begin", [], async () => {
    return new Response();
  })
  .post("/webauthn/signin/complete", [], async () => {
    return new Response();
  })
  .post("/webauthn/signin/verify", [], async () => {
    return new Response();
  })
  .post(
    "/signin-challenge",
    [private_, data_(type({ token: "string" }))],
    async ({ auth, data }, env) => {
      const api = passwordless(env.API_URL_PASSWORDLESS);
      const response = await api.post("/signin/verify", {
        headers: { "Content-Type": "application/json", ApiSecret: auth.pk },
        body: JSON.stringify({ token: data.token }),
      });

      const signin = await response.json();
      if (!signin.success) {
        return error(403, {
          message: "verification_failed",
          data: { ...signin, success: false },
        });
      }

      return ok(200, { ...signin, success: true });
    }
  )
  .post(
    "/list-credentials",
    [private_, data_(type({ username: "string" }))],
    async ({ auth, data }, env) => {
      const api = passwordless(env.API_URL_PASSWORDLESS);
      const response = await api.post("/credentials/list", {
        headers: { "Content-Type": "application/json", ApiSecret: auth.pk },
        body: JSON.stringify({ userId: data.username }),
      });

      if (!response.ok) {
        return error(403, { message: "list_not_allowed" });
      }

      const { values } = await response.json();

      return ok(200, { credentials: values });
    }
  )
  .post(
    "/delete-credential",
    [private_, data_(type({ credentialId: "string" }))],
    async ({ auth, data }, env) => {
      const api = passwordless(env.API_URL_PASSWORDLESS);
      const response = await api.post("/credentials/delete", {
        headers: { "Content-Type": "application/json", ApiSecret: auth.pk },
        body: JSON.stringify({ credentialId: data.credentialId }),
      });

      if (!response.ok) {
        return error(403, { message: "delete_not_allowed" });
      }

      const credentials = await response.json();

      return ok(200, { credentials });
    }
  )
  .post(
    "/new-user",
    [private_, data_(type({ email: "string", username: "string" }))],
    async ({ auth, data: { email, username } }, env, ctx) => {
      const user = $user(env.DO_USER, {
        application: auth.id,
        username,
      });

      const response = await user.post("/challenge-device-unverified", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        return response;
      }
      const { code, id } = await response.json();

      const body = createBody({
        email,
        username,
        code,
        dkim: env.DKIM_PRIVATE_KEY,
      });

      ctx.waitUntil(sendEmail(env.API_URL_MAILCHANNELS, body));

      return ok(200, { slip: id });
    }
  )
  .post(
    "/verify-device",
    [
      private_,
      data_(type({ username: "string", code: "string", id: "string" })),
    ],
    async ({ data: { username, code, id }, auth }, env) => {
      try {
        const verifyCode = async () => {
          const user = $user(env.DO_USER, {
            application: auth.id,
            username,
          });

          const response = await user.post(`/verify-device/${id}/${code}`);
          if (response.status === 403) {
            const { message } = await response.json();
            console.log(message);
          }

          return response.ok;
        };

        const verified = await verifyCode();
        if (!verified) {
          return error(403, { message: "attempt_invalid" });
        }

        const token = await registerToken(env.API_URL_PASSWORDLESS, {
          username,
          pk: auth.pk,
        });
        if (!token) {
          return error(403, { message: "registration_not_allowed" });
        }

        return ok(200, { token });
      } catch {
        return error(404, { message: "user_missing" });
      }
    }
  )
  .post(
    "/new-device",
    [private_, data_(type({ username: "string" }))],
    async ({ auth, data: { username } }, env, ctx) => {
      try {
        const user = $user(env.DO_USER, {
          application: auth.id,
          username,
        });
        const response = await user.post("/challenge-device");

        if (!response.ok) {
          return response;
        }
        const { email, code, id } = await response.json();

        const body = createBody({
          email,
          username,
          code,
          dkim: env.DKIM_PRIVATE_KEY,
        });

        ctx.waitUntil(sendEmail(env.API_URL_MAILCHANNELS, body));

        return ok(200, { slip: id });
      } catch (err) {
        console.error(err);
        return error(404, "user_missing");
      }
    }
  )
  .all("/*", [], () => {
    return new Response("Not found", { status: 404 });
  });

const routes = router.infer;
/** @public */
export type Routes = typeof routes;

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

const handler: ExportedHandler<Env> = {
  fetch: router.handle,
};

export default handler;

const createName = (slug: string, username: string) => {
  return `${slug}#${username}`;
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

const hour1 = () => new Date(Date.now() + 1000 * 60 * 60);
const minute5 = () => new Date(Date.now() + 1000 * 60 * 5);

const qmarks = (length: number) => new Array(length).fill("?").join(",");

const areAliasesTaken = async (
  db: D1Database,
  app: string,
  aliases: string[]
) => {
  const values = qmarks(aliases.length);
  const result = await db
    .prepare(
      `SELECT COUNT(*) FROM alias WHERE application_id = ? AND name IN (${values})`
    )
    .bind(app, ...aliases)
    .first<number>();

  return result === 0 || result === null;
};

const createChallenge = async (namespace: DurableObjectNamespace) => {
  const session = namespace.newUniqueId();
  const challenge = $webauthn(namespace, session.toString());
  const response = await challenge.post("/challenge", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: true, expiry: hour1(), attempts: 1 }),
  });

  invariant(response.ok, "unexpected error");
  return { session, code: (await response.json()).code };
};

const aliasedUserId = async (db: D1Database, app: string, alias: string) => {
  const result = await db
    .prepare(`SELECT user_id FROM alias WHERE application_id = ? AND name = ?`)
    .bind(app, alias)
    .first<string>();

  return result;
};
