import type { Routes } from "@mewhhaha/authfordev-api";
import { fetcher } from "@mewhhaha/little-fetcher";
import type { DataFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { authenticate, makeSession, removeSession } from "~/auth/session";

const urlSignIn = "/auth/sign-in";
const urlSignInSuccess = "/";
const urlInputCode = (username: string, slip: string) =>
  `/auth/input-code/${encodeURIComponent(username)}/${slip}`;

const authfordev = fetcher<Routes>("fetch", {
  base: "https://user.authfor.dev",
});

export async function action({ request, context: { env } }: DataFunctionArgs) {
  const authorization = env.AUTHFORDEV_AUTHORIZATION;

  const formData = await request.formData();
  const url = new URL(request.url);
  const act = url.searchParams.get("act");

  const form = {
    // In this example the username is synonymous with the email, but you could make these be different
    email: formData.get("username")?.toString(),
    username: formData.get("username")?.toString(),
    token: formData.get("token")?.toString(),
    slip: formData.get("slip")?.toString(),
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
      const { data } = await signIn(authorization, { token: form.token });
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
      const data = await newUser(authorization, {
        email: form.email,
        username: form.username,
      });
      if (data.slip !== undefined) {
        throw redirect(urlInputCode(form.username, data.slip));
      } else {
        return {
          success: false,
          reason:
            data.status === 429
              ? "Too many attempts, try again later"
              : "User already exists",
        } as const;
      }
    }
    case "new-device": {
      if (!form.username) {
        throw new Response("Missing form data for new-device", {
          status: 422,
        });
      }
      const data = await newDevice(authorization, { username: form.username });
      if (data.slip !== undefined) {
        throw redirect(urlInputCode(form.username, data.slip));
      } else {
        return {
          success: false,
          reason:
            data.status === 429
              ? "Too many attempts, try again later"
              : "User is missing",
        } as const;
      }
    }
    case "register-device": {
      if (!form.code || !form.slip || !form.username) {
        throw new Response("Missing form data for register-device", {
          status: 422,
        });
      }
      const data = await registerDevice(authorization, {
        username: form.username,
        code: form.code,
        slip: form.slip,
      });

      if (data) {
        return { success: true, token: data.token } as const;
      } else {
        return { success: false } as const;
      }
    }
  }

  throw new Response("Not found", { status: 404 });
}

const signIn = async (authorization: string, { token }: { token: string }) => {
  const response = await authfordev.post("/sign-in", {
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    return { data: undefined };
  }

  return { data: await response.json() };
};

const newUser = async (
  authorization: string,
  { username, email }: { username: string; email: string }
) => {
  const response = await authfordev.post("/new-user", {
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, email }),
  });

  if (!response.ok) {
    return { slip: undefined, status: response.status } as const;
  }

  return await response.json();
};

const newDevice = async (
  authorization: string,
  { username }: { username: string }
) => {
  const response = await authfordev.post("/new-device", {
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    return { slip: undefined, status: response.status } as const;
  }

  return await response.json();
};

const registerDevice = async (
  authorization: string,
  { username, code, slip }: { username: string; code: string; slip: string }
) => {
  const response = await authfordev.post("/verify-device", {
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({ username, code, slip }),
  });

  if (!response.ok) {
    return { token: undefined } as const;
  }

  return await response.json();
};
