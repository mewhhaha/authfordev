import type { DataFunctionArgs } from "@remix-run/cloudflare";
import { authfordev } from "~/api/authfordev";
import { authenticate, makeSession, removeSession } from "~/auth/session";

const urlSignIn = "/auth/sign-in";
const urlSignInSuccess = "/";

export async function action({ request, context: { env } }: DataFunctionArgs) {
  const formData = await request.formData();
  const url = new URL(request.url);
  const act = url.searchParams.get("act");

  const form = {
    // In this example the username is synonymous with the email, but you could make these be different
    email: formData.get("email")?.toString(),
    username: formData.get("username")?.toString(),
    token: formData.get("token")?.toString(),
    code: formData.get("code")?.toString(),
  };

  switch (act) {
    case "sign-out": {
      const session = await authenticate(request, env);
      if (!session) {
        return new Response(null, {
          headers: { Location: urlSignIn },
          status: 303,
        });
      }

      const sessionHeaders = await removeSession(request, env);
      return new Response(null, {
        headers: {
          ...sessionHeaders,
          Location: urlSignIn,
        },
        status: 303,
      });
    }
    case "sign-in": {
      if (!form.token) {
        return new Response("Missing form data for sign-in", { status: 422 });
      }
      const { data } = await signIn(env.AUTH_SERVER_KEY, {
        token: form.token,
        origin: env.ORIGIN,
      });
      if (data) {
        const headers = await makeSession(request, env, {
          id: data.userId,
          credentialId: data.credentialId,
        });
        return new Response(null, {
          status: 200,
          headers: { ...headers, Location: urlSignInSuccess },
        });
      } else {
        return new Response("Sign in failed", { status: 401 });
      }
    }
    case "new-user": {
      if (!form.email || !form.username) {
        return new Response("Missing form data for new-user", { status: 422 });
      }
      const data = await newUser(env.AUTH_SERVER_KEY, {
        email: form.email,
        aliases: [form.username],
      });

      if (data.token === undefined) {
        return new Response("User already exists", {
          status: 409,
        });
      }

      const to = `/auth/input-code/${encodeURIComponent(
        form.username
      )}?challenge=${data.token}`;

      return new Response(null, { status: 200, headers: { Location: to } });
    }
    case "new-device": {
      if (!form.username) {
        return new Response("Missing form data for new-device", {
          status: 422,
        });
      }
      const data = await newDevice(env.AUTH_SERVER_KEY, {
        alias: form.username,
      });

      if (data.token === undefined) {
        return { success: false, reason: "user_missing" } as const;
      }

      const to = `/auth/input-code/${encodeURIComponent(
        form.username
      )}?challenge=${data.token}`;

      return new Response(null, { headers: { Location: to }, status: 200 });
    }
    case "register-device": {
      if (!form.token) {
        return new Response("Missing form data for register-device", {
          status: 422,
        });
      }
      const data = await registerCredential(env.AUTH_SERVER_KEY, {
        token: form.token,
        origin: env.ORIGIN,
      });

      if (data?.userId) {
        const sessionHeaders = await makeSession(request, env, {
          id: data.userId,
          credentialId: data.credentialId,
        });
        return new Response(null, {
          status: 200,
          headers: { ...sessionHeaders, Location: urlSignInSuccess },
        });
      } else {
        return new Response("Register device failed", { status: 401 });
      }
    }
  }

  return new Response("Not found", { status: 404 });
}

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
