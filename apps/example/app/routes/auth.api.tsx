import type { DataFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
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
    email: formData.get("username")?.toString(),
    username: formData.get("username")?.toString(),
    token: formData.get("token")?.toString(),
    code: formData.get("code")?.toString(),
  };

  switch (act) {
    case "sign-out": {
      const session = await authenticate(request, env);
      if (!session) {
        throw redirect(urlSignIn);
      }

      throw redirect(urlSignIn, {
        headers: await removeSession(request, env),
      });
    }
    case "sign-in": {
      if (!form.token) {
        throw new Response("Missing form data for sign-in", { status: 422 });
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
        throw redirect(urlSignInSuccess, { headers });
      } else {
        return { success: false } as const;
      }
    }
    case "new-user": {
      if (!form.email || !form.username) {
        throw new Response("Missing form data for new-user", { status: 422 });
      }
      const data = await newUser(env.AUTH_SERVER_KEY, {
        email: form.email,
        aliases: [form.username],
      });

      if (data.token === undefined) {
        return { success: false, reason: "user_taken" } as const;
      }

      throw redirect(
        `/auth/input-code/${encodeURIComponent(form.username)}?challenge=${
          data.token
        }`
      );
    }
    case "new-device": {
      if (!form.username) {
        throw new Response("Missing form data for new-device", {
          status: 422,
        });
      }
      const data = await newDevice(env.AUTH_SERVER_KEY, {
        alias: form.username,
      });

      if (data.token === undefined) {
        return { success: false, reason: "user_missing" } as const;
      }

      throw redirect(
        `/auth/input-code/${encodeURIComponent(form.username)}?challenge=${
          data.token
        }`
      );
    }
    case "register-device": {
      if (!form.token) {
        throw new Response("Missing form data for register-device", {
          status: 422,
        });
      }
      const data = await registerCredential(env.AUTH_SERVER_KEY, {
        token: form.token,
        origin: env.ORIGIN,
      });

      if (data?.userId) {
        const headers = await makeSession(request, env, {
          id: data.userId,
          credentialId: data.credentialId,
        });
        throw redirect(urlSignInSuccess, { headers });
      } else {
        return { success: false } as const;
      }
    }
  }

  throw new Response("Not found", { status: 404 });
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
