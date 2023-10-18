import { json, redirect } from "@remix-run/cloudflare";
import { authfordev } from "~/api/authfordev";
import type { SessionData } from "./authenticate.server";
import {
  authenticate,
  removeSession,
  makeSession,
} from "./authenticate.server";
import { Intent } from "./intent";

export const endpoint = async ({
  request,
  secrets,
  serverKey,
  origin,
  redirects,
  sessionData = (session) => session,
}: {
  request: Request;
  secrets: string | string[];
  serverKey: string;
  origin: string;
  redirects: {
    success: (user: { id: string }) => string;
    signin: () => string;
    signout: () => string;
    challenge: (username: string, token: string) => string;
  };
  sessionData?: (user: {
    id: string;
    credentialId: string;
  }) => Required<SessionData>;
}) => {
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
        return json({
          message: `Missing form data for ${form.intent}`,
          status: 422,
        });
      }
      const { data } = await signIn(serverKey, {
        token: form.token,
        origin: origin,
      });
      if (data) {
        const sessionHeaders = await makeSession(
          request,
          secrets,
          sessionData({
            id: data.userId,
            credentialId: data.credentialId,
          })
        );
        return redirect(redirects.success({ id: data.userId }), {
          status: 303,
          headers: sessionHeaders,
        });
      } else {
        return json({ message: "Signing in failed", status: 401 });
      }
    }
    case Intent.SignUp: {
      if (!form.email || !form.username) {
        return json({
          message: `Missing form data for ${form.intent}`,
          status: 422,
        });
      }
      const data = await signUp(serverKey, {
        email: form.email,
        aliases: [form.username],
      });

      if (data.token === undefined) {
        switch (data.status) {
          case 409:
            return json({ message: "User already exists", status: 409 });
          default:
            return json({
              message: "Creating new user failed",
              status: data.status,
            });
        }
      }

      const to = redirects.challenge(form.username, data.token);
      return redirect(to, { status: 303 });
    }
    case Intent.RequestCode: {
      if (!form.username) {
        return json({
          message: `Missing form data for ${form.intent}`,
          status: 422,
        });
      }
      const data = await requestCode(serverKey, {
        alias: form.username,
      });

      if (data.token === undefined) {
        switch (data.status) {
          case 404:
            return json({ message: "User is missing", status: 404 });
          default:
            return json({
              message: "Creating challenge for user failed",
              status: data.status,
            });
        }
      }

      const to = redirects.challenge(form.username, data.token);
      return redirect(to, { status: 303 });
    }
    case Intent.CreatePasskey: {
      if (!form.token) {
        return json({
          message: `Missing form data for ${form.intent}`,
          status: 422,
        });
      }
      const data = await createPasskey(serverKey, {
        token: form.token,
        origin: origin,
      });

      if (data?.userId) {
        const sessionHeaders = await makeSession(request, secrets, {
          id: data.userId,
          credentialId: data.credentialId,
        });

        return redirect(redirects.success({ id: data.userId }), {
          status: 303,
          headers: sessionHeaders,
        });
      } else {
        return json({ message: "Registering device failed", status: 401 });
      }
    }
  }

  return new Response("Not found", { status: 404 });
};

const signIn = async (
  serverKey: string,
  { token, origin }: { token: string; origin: string }
) => {
  const response = await authfordev.post("/server/verify-signin", {
    headers: {
      Authorization: serverKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, origin }),
  });

  if (!response.ok) {
    return { data: undefined };
  }

  return { data: await response.json() };
};

const signUp = async (
  serverKey: string,
  { aliases, email }: { aliases: string[]; email: string }
) => {
  const response = await authfordev.post("/server/new-user", {
    headers: {
      Authorization: serverKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ aliases, email }),
  });

  if (!response.ok) {
    return { token: undefined, status: response.status } as const;
  }

  return await response.json();
};

const requestCode = async (serverKey: string, { alias }: { alias: string }) => {
  const response = await authfordev.post("/server/new-device", {
    headers: {
      Authorization: serverKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ alias }),
  });

  if (!response.ok) {
    return { token: undefined, status: response.status } as const;
  }

  return await response.json();
};

const createPasskey = async (
  serverKey: string,
  { token, origin }: { token: string; origin: string }
) => {
  const response = await authfordev.post("/server/register-credential", {
    headers: {
      "Content-Type": "application/json",
      Authorization: serverKey,
    },
    body: JSON.stringify({ token, origin }),
  });

  if (!response.ok) {
    return { userId: undefined } as const;
  }

  return await response.json();
};
