import { createCookieSessionStorage, redirect } from "@remix-run/cloudflare";
import { authfordev } from "~/api/authfordev";
import {
  authenticate,
  removeSession,
  makeSession,
} from "./authenticate.server";

export const endpoint = async ({
  request,
  secrets,
  serverKey,
  origin,
  redirects,
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
    case "sign-out": {
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
    case "sign-in": {
      if (!form.token) {
        return new Response("Missing form data for sign-in", { status: 422 });
      }
      const { data } = await signIn(serverKey, {
        token: form.token,
        origin: origin,
      });
      if (data) {
        const sessionHeaders = await makeSession(request, secrets, {
          id: data.userId,
          credentialId: data.credentialId,
        });
        return redirect(redirects.success({ id: data.userId }), {
          status: 303,
          headers: sessionHeaders,
        });
      } else {
        return new Response("Sign in failed", { status: 401 });
      }
    }
    case "new-user": {
      if (!form.email || !form.username) {
        return new Response("Missing form data for new-user", {
          status: 422,
        });
      }
      const data = await newUser(serverKey, {
        email: form.email,
        aliases: [form.username],
      });

      if (data.token === undefined) {
        switch (data.status) {
          case 409:
            return new Response("User already exists", {
              status: 409,
            });
          default:
            return new Response("New user failed", { status: data.status });
        }
      }

      const to = redirects.challenge(form.username, data.token);
      return redirect(to, { status: 303 });
    }
    case "new-device": {
      if (!form.username) {
        return new Response("Missing form data for new-device", {
          status: 422,
        });
      }
      const data = await newDevice(serverKey, {
        alias: form.username,
      });

      if (data.token === undefined) {
        switch (data.status) {
          case 404:
            return new Response("User is missing", {
              status: 404,
            });
          default:
            return new Response("New device failed", { status: data.status });
        }
      }

      const to = redirects.challenge(form.username, data.token);
      return redirect(to, { status: 303 });
    }
    case "verify-device": {
      if (!form.token) {
        return new Response("Missing form data for verify-device", {
          status: 422,
        });
      }
      const data = await registerCredential(serverKey, {
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
        return new Response("Register device failed", { status: 401 });
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

const newUser = async (
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

const newDevice = async (serverKey: string, { alias }: { alias: string }) => {
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

const registerCredential = async (
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

export type SessionData = {
  id: string;
  credentialId: string;
};

export const createAppCookieSessionStorage = (secrets: string | string[]) => {
  return createCookieSessionStorage<SessionData>({
    cookie: {
      name: "__session",
      httpOnly: true,
      path: "/",

      sameSite: "lax",
      secrets: typeof secrets === "string" ? [secrets] : secrets,
      secure: true,
    },
  });
};
