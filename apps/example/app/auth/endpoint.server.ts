import { json, redirect } from "@remix-run/cloudflare";
import { authfordev } from "~/api/authfordev";
import type { SessionData } from "./authenticate.server";
import {
  authenticate,
  removeSession,
  makeSession,
} from "./authenticate.server";
import { Intent } from "./intent";

export const endpoint = async (
  serverKey: string,
  {
    request,
    secrets,
    origin,
    redirects,
    session: { data: sessionData, expires: sessionExpires },
  }: {
    request: Request;
    secrets: string | string[];
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
      expires?: Date;
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

  switch (form.intent) {
    case Intent.SignOut: {
      const session = await authenticate(request, secrets);
      if (!session) {
        return redirect(redirects.signout(), {
          status: 303,
        });
      }

      const sessionHeaders = await removeSession(request, secrets);
      return redirect(redirects.signout(), {
        status: 303,
        headers: sessionHeaders,
      });
    }
    case Intent.SignIn: {
      if (!form.token) {
        return json({ message: "form_data_missing", status: 422 });
      }
      const { data } = await newSignin(serverKey, {
        token: form.token,
        origin,
      });
      if (data) {
        const sessionHeaders = await makeSession(
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
      const sessionHeaders = await makeSession(
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
  }

  return new Response("Not found", { status: 404 });
};

const newSignin = async (
  serverKey: string,
  { token, origin }: { token: string; origin: string }
) => {
  const response = await authfordev.post("/server/actions/verify-passkey", {
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
  const response = await authfordev.post("/server/users", {
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
  const response = await authfordev.post("/server/actions/check-aliases", {
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
