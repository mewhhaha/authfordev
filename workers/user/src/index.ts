import {
  Plugin,
  PluginContext,
  Router,
  RoutesOf,
} from "@mewhhaha/little-router";
import { BodySend, mailChannels } from "./api/mail-channels";
import { error, ok } from "@mewhhaha/typed-response";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { type } from "arktype";
import { BodyRegisterToken, passwordless } from "./api/passwordless";
import { fetcher } from "@mewhhaha/little-fetcher";
import { parseJwt, decodeJwt } from "@internal/jwt";

interface Env {
  API_URL_PASSWORDLESS: string;
  API_URL_MAILCHANNELS: string;
  SECRET_FOR_HMAC: string;
  DO_USER: DurableObjectNamespace;
  DKIM_PRIVATE_KEY: string;
}

type DeviceSlip = {
  code: string;
  id: string;
  attempts: number;
  expiry: Date;
};

const verified_ = (async (_: PluginContext, user: DurableObjectUser) => {
  if (!user.verified || !user.email) {
    return error(403, { message: "user not verified" });
  }

  return { email: user.email };
}) satisfies Plugin<[DurableObjectUser]>;

export class DurableObjectUser implements DurableObject {
  email?: string;
  slip?: DeviceSlip;
  verified?: boolean;

  storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;

    state.blockConcurrencyWhile(async () => {
      const load = async <T extends keyof this>(key: T) => {
        const value = await this.storage.get<this[T]>(key as string);
        if (value) {
          this[key] = value;
        }
      };
      await Promise.all([load("slip"), load("email")]);
    });
  }

  generateSlip() {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);

    this.slip = {
      id: crypto.randomUUID(),
      attempts: 0,
      code: generateToken(),
      expiry: expiry,
    };

    return { slip: this.slip } as const;
  }

  attemptSlip({ code, id }: { code: string; id: string }) {
    if (this.slip === undefined) {
      return { success: false, message: "missing slip" } as const;
    }

    const attempt = (slip: DeviceSlip) => {
      if (slip.attempts >= 3) {
        return "slip has expired";
      } else if (slip.expiry > new Date()) {
        return "slip has expired";
      } else if (id !== slip?.id) {
        return "invalid slip id";
      } else if (code !== slip?.code) {
        return "invalid slip code";
      }
    };

    const invalid = attempt(this.slip);
    if (invalid) {
      this.slip.attempts += 1;
      return { success: false, message: invalid } as const;
    }

    this.slip = undefined;
    return { success: true } as const;
  }

  static router = Router<[DurableObjectUser]>()
    .post("/initiate", [data_(type({ email: "string" }))], ({ data }, user) => {
      if (user.verified) {
        return error(403, { message: "already verified" });
      }

      user.email = data.email;

      const { slip } = user.generateSlip();

      return ok(200, { code: slip.code, id: slip.id });
    })
    .post("/devices/new", [verified_], ({ email }, user) => {
      const { slip } = user.generateSlip();
      return ok(200, { email, code: slip.code, id: slip.id });
    })
    .post(
      "/devices/verify",
      [verified_, data_(type({ code: "string", id: "string" }))],
      ({ data }, user) => {
        const { success, message } = user.attemptSlip(data);
        if (!success) {
          return error(403, { message });
        }

        return ok(200);
      }
    );

  fetch(
    request: Request<unknown, CfProperties<unknown>>
  ): Response | Promise<Response> {
    return DurableObjectUser.router.handle(request, this);
  }
}

const auth_ = (async (
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
    return error(403, { message: "authorization header missing" });
  }

  const jwt = parseJwt(header);

  if (!jwt) {
    return error(403, { message: "authorization header invalid" });
  }

  const auth = await decodeJwt(env.SECRET_FOR_HMAC, jwt);

  if (!auth) {
    return error(403, { message: "jwt token invalid" });
  }

  return { auth };
}) satisfies Plugin<[Env]>;

const router = Router<[Env, ExecutionContext]>()
  .post(
    "/signin",
    [auth_, data_(type({ token: "string" }))],
    async ({ auth, data }, env) => {
      const api = passwordless(env.API_URL_PASSWORDLESS);
      const response = await api.post("/signin/verify", {
        headers: { "Content-Type": "application/json", ApiSecret: auth.pk },
        body: JSON.stringify({ token: data.token }),
      });

      const signin = await response.json();
      if (!signin.success) {
        return error(403, { message: "failed verification" });
      }

      return ok(200, { ...signin, success: true });
    }
  )

  .post(
    "/new-user",
    [auth_, data_(type({ email: "string", username: "string" }))],
    async ({ auth, data: { email, username } }, env, ctx) => {
      const user = fetcherUser(env.DO_USER, {
        application: auth.id,
        username,
      });

      const response = await user.post("/initiate", {
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
        application: auth.id,
        code,
        dkim: env.DKIM_PRIVATE_KEY,
      });
      ctx.waitUntil(sendEmail(env.API_URL_MAILCHANNELS, body));

      return ok(200, { id });
    }
  )
  .post(
    "/verify-device",
    [
      auth_,
      data_(type({ username: "string", code: "string", slip: "string" })),
    ],
    async ({ data: { username, code, slip }, auth }, env) => {
      try {
        const verifyCode = async () => {
          const user = fetcherUser(env.DO_USER, {
            application: auth.id,
            username: username,
          });

          const response = await user.post("/devices/verify", {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, id: slip }),
          });

          if (response.status === 403) {
            const { message } = await response.json();
            console.log(message);
          }

          return response.ok;
        };

        const verified = await verifyCode();
        if (!verified) {
          return error(403, { message: "attempt is not valid" });
        }

        const token = await registerToken(env.API_URL_PASSWORDLESS, {
          username,
          pk: auth.pk,
        });
        if (!token) {
          return error(403, { message: "not allowed registration" });
        }

        return ok(200, { token });
      } catch {
        return error(404, { message: "user not found" });
      }
    }
  )
  .post(
    "/new-device",
    [auth_, data_(type({ username: "string" }))],
    async ({ auth, data: { username } }, env, ctx) => {
      const user = fetcherUser(env.DO_USER, {
        application: auth.id,
        username,
      });
      const response = await user.post("/devices/new");

      if (!response.ok) {
        return response;
      }
      const { email, code, id } = await response.json();

      const body = createBody({
        email,
        username,
        application: auth.id,
        code,
        dkim: env.DKIM_PRIVATE_KEY,
      });

      ctx.waitUntil(sendEmail(env.API_URL_MAILCHANNELS, body));

      return ok(200, { id });
    }
  );

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

const registerToken = async (
  apiUrl: string,
  { username, pk }: { username: string; pk: string }
) => {
  const pw = passwordless(apiUrl);

  const body: BodyRegisterToken = {
    userId: username,
    username: username,
  };

  const response = await pw.post("/register/token", {
    headers: { "Content-Type": "application/json", ApiSecret: pk },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return null;
  }

  const { token } = await response.json();
  return token;
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
  application,
  code,
  dkim,
}: {
  email: string;
  username: string;
  application: string;
  code: string;
  dkim: string;
}): BodySend => {
  return {
    personalizations: [
      {
        to: [{ email, name: email.split("@")[0] }],
        // https://support.mailchannels.com/hc/en-us/articles/7122849237389
        dkim_domain: "authfor.dev",
        dkim_selector: "mailchannels",
        dkim_private_key: dkim,
      },
    ],
    from: {
      email: "noreply@authfor.dev",
      name: `${application} support`,
    },
    subject: `New device for ${username}`,
    content: [defaultEmail({ code })],
  };
};

const getUserStub = (
  namespace: DurableObjectNamespace,
  { application, username }: { application: string; username: string }
) => namespace.get(namespace.idFromName(createName(application, username)));

const fetcherUser = (
  namespace: DurableObjectNamespace,
  values: { application: string; username: string }
) =>
  fetcher<RoutesOf<(typeof DurableObjectUser)["router"]>>(
    getUserStub(namespace, values)
  );

const defaultEmail = ({ code }: { code: string }) =>
  ({
    type: "text/plain",
    value: `Input the following code by copy-pasting or typing it in manually: ${code}. If you didn't request this, then you can ignore this email.`,
  } as const);

const generateToken = () => {
  const buffer = new Uint8Array(6);
  const randomBuffer = crypto.getRandomValues(buffer);
  return [...randomBuffer].map((value) => (value % 10).toString()).join("");
};
