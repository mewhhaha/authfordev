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
    passkeyId: formData.get("passkeyId")?.toString(),
    passkeyName: formData.get("passkeyName")?.toString(),
  };

  const session = await storage.authenticate(request, secrets);

  const unauthenticated = async () => {
    switch (form.intent) {
      case Intent.SignIn: {
        if (!form.token) {
          return json({ message: "form_data_missing", status: 422 });
        }
        const response = await api.post(
          "/server/actions/verify-passkey",
          jsonBody({ token: form.token, origin }, serverKey)
        );

        if (response.ok) {
          const data = await response.json();
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

        const response = await api.post(
          "/server/users",
          jsonBody(
            { origin, aliases: [form.username], token: form.token },
            serverKey
          )
        );

        if (response.status === 409) {
          return { message: "aliases_taken", status: 409 } as const;
        } else if (!response.ok) {
          return { message: "new_user_failed", status } as const;
        }

        const data = await response.json();
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

        const response = await api.post(
          "/server/actions/check-aliases",
          jsonBody({ aliases: [form.username] }, serverKey)
        );

        if (!response.ok) {
          return { message: "check_aliases_failed", status } as const;
        }

        const data = await response.json();
        if (data.aliases.some(([_, exists]) => exists)) {
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
          jsonBody({ token: form.token, origin }, serverKey)
        );

        if (!response.ok) {
          return { message: "add_passkey_failed", status: response.status };
        }
      }
      case Intent.RemovePasskey: {
        const response = await api.delete(
          `/server/users/${session.userId}/passkeys/${form.passkeyId}`,
          { headers: { Authorization: serverKey } }
        );
        return { success: response.ok };
      }

      case Intent.RenamePasskey: {
        if (!form.passkeyName) {
          return { success: false, message: "form_data_missing" };
        }

        const response = await api.put(
          `/server/users/${session.userId}/rename-passkey/${form.passkeyId}`,
          jsonBody({ name: form.passkeyName }, serverKey)
        );

        return { success: response.ok };
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

const jsonBody: JSONBody = <T, Y extends string>(
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
