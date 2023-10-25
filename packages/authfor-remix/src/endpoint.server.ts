import type {
  SessionData,
  createSimpleCookieSessionStorage,
} from "./authenticate.server.js";
import { redirect, json } from "@remix-run/router";
import { Intent, api } from "./api.js";
import type { JSONString } from "@mewhhaha/json-string";
export { createSimpleCookieSessionStorage } from "./authenticate.server.js";

export const endpoint = async (
  serverKey: string,
  {
    request,
    origin,
    redirects,
    session: { data: sessionData, expires: sessionExpires, storage, secrets },
  }: {
    request: Request;
    origin: string;
    redirects: {
      signup: (user: { userId: string; passkeyId: string }) => string;
      signin: (user: { userId: string; passkeyId: string }) => string;
      signout: () => string;
    };
    session: {
      data: (user: {
        userId: string;
        passkeyId: string;
      }) => Required<SessionData>;
      storage: ReturnType<typeof createSimpleCookieSessionStorage>;
      expires?: Date;
      secrets: string | string[];
    };
  }
) => {
  const formData = await request.formData();

  const form = {
    intent: formData.get("intent")?.toString(),
    email: formData.get("email")?.toString(),
    username: formData.get("username")?.toString(),
    token: formData.get("token")?.toString(),
    code: formData.get("code")?.toString(),
  };

  const session = await storage.authenticate(request, secrets);

  const unauthenticated = async () => {
    switch (form.intent) {
      case Intent.SignIn: {
        if (!form.token) {
          return json({ message: "form_data_missing", status: 422 });
        }
        const { data } = await newSignin(serverKey, {
          token: form.token,
          origin,
        });
        if (data) {
          const sessionHeaders = await storage.create(
            request,
            secrets,
            sessionData(data),
            { expires: sessionExpires }
          );
          return redirect(redirects.signin(data), {
            status: 303,
            headers: sessionHeaders,
          });
        } else {
          return json({ message: "signin_failed", status: 401 });
        }
      }
      case Intent.SignUp: {
        if (!form.username || !form.token) {
          return json({ message: "form_data_missing", status: 422 });
        }
        const { data, status } = await newUser(serverKey, {
          origin,
          aliases: [form.username],
          token: form.token,
        });

        if (status === 409) {
          return { message: "aliases_taken", status: 409 } as const;
        } else if (status) {
          return { message: "new_user_failed", status } as const;
        }
        const sessionHeaders = await storage.create(
          request,
          secrets,
          sessionData(data),
          { expires: sessionExpires }
        );
        const to = redirects.signup(data);
        return redirect(to, { status: 303, headers: sessionHeaders });
      }
      case Intent.CheckAliases: {
        if (!form.username) {
          return json({ message: "form_data_missing", status: 422 });
        }

        const { data, status } = await checkAliases(serverKey, {
          aliases: [form.username],
        });
        if (status) {
          return { message: "check_aliases_failed", status } as const;
        }

        if (data.occupied) {
          return { message: "aliases_taken", status: 409 } as const;
        }

        return { message: "aliases_available", status: 200 } as const;
      }
      default: {
        return false;
      }
    }
  };

  const authenticated = async () => {
    if (!session) {
      return redirect(redirects.signout(), {
        status: 303,
      });
    }

    switch (form.intent) {
      case Intent.SignOut: {
        const sessionHeaders = await storage.remove(request, secrets);
        return redirect(redirects.signout(), {
          status: 303,
          headers: sessionHeaders,
        });
      }
      case Intent.AddPasskey: {
        if (!form.token) {
          return json({ message: "form_data_missing", status: 422 });
        }

        const response = await api.post(
          `/server/users/${session.userId}/passkeys`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: serverKey,
            },
            body: JSON.stringify({ token: form.token, origin }),
          }
        );

        if (!response.ok) {
          return { message: "add_passkey_failed", status: response.status };
        }
      }
    }
  };

  const unauthResponse = await unauthenticated();
  if (unauthResponse) {
    return unauthResponse;
  }

  const authResponse = await authenticated();
  if (authResponse) {
    return authResponse;
  }

  throw new Response("Not found", { status: 404 });
};

const newSignin = async (
  serverKey: string,
  { token, origin }: { token: string; origin: string }
) => {
  const response = await api.post("/server/actions/verify-passkey", {
    headers: {
      Authorization: serverKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, origin }),
  });

  if (!response.ok) {
    return { status: response.status } as const;
  }

  return { data: await response.json() } as const;
};

const newUser = async (
  serverKey: string,
  {
    aliases,
    token,
    origin,
  }: { aliases: string[]; token: string; origin: string }
) => {
  const response = await api.post("/server/users", {
    headers: {
      Authorization: serverKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ aliases, token, origin }),
  });

  if (!response.ok) {
    return { status: response.status } as const;
  }

  return { data: await response.json() } as const;
};

const checkAliases = async (
  serverKey: string,
  { aliases }: { aliases: string[] }
) => {
  const response = await api.post("/server/actions/check-aliases", {
    headers: {
      Authorization: serverKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ aliases }),
  });

  if (!response.ok) {
    return { status: response.status } as const;
  }

  const data = await response.json();

  return {
    data: { occupied: data.aliases.some(([_, exists]) => exists) },
  } as const;
};

type JSONBody = {
  <T>(
    body: T,
    authorization?: undefined
  ): {
    headers: { "Content-Type": "application/json" };
    body: JSONString<T>;
  };
  <T, Y extends string>(
    body: T,
    authorization: Y
  ): {
    headers: { "Content-Type": "application/json"; Authorization: Y };
    body: JSONString<T>;
  };
};

export const jsonBody: JSONBody = <T, Y extends string>(
  body: T,
  authorization?: Y
) => {
  return {
    headers: {
      "Content-Type": "application/json" as const,
      Authorization: authorization,
    },
    body: JSON.stringify(body),
  };
};
