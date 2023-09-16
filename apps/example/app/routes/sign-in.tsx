import { Client } from "@passwordlessdev/passwordless-client";
import { redirect, type DataFunctionArgs } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import type { FormEvent, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { authfordev } from "~/api/authfordev";
import { makeSession } from "~/auth/session";
import { Button } from "~/components/Button";

import { FormItem } from "~/components/FormItem";
import { InputText } from "~/components/InputText";

const form = {
  email: {
    id: "email",
    name: "email",
    type: "email",
  },
};

export async function loader({ context: { env } }: DataFunctionArgs) {
  return {
    clientArgs: {
      apiKey: env.PASSWORDLESS_PUBLIC_KEY,
      apiUrl: env.PASSWORDLESS_API_URL,
    },
  };
}

export async function action({ request, context: { env } }: DataFunctionArgs) {
  const formData = await request.formData();
  const token = formData.get("token")?.toString();
  if (!token) {
    return { success: false } as const;
  }
  const api = authfordev("https://user.authfor.dev");

  const response = await api.post("/signin", {
    headers: {
      Authorization: env.AUTHFOR_AUTHORIZATION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    return { success: false } as const;
  }

  const data = await response.json();

  const headers = await makeSession(request, env, {
    id: data.userId,
    credentialId: data.credentialId,
  });

  throw redirect("/", { headers });
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const navigation = useNavigation();
  const navigate = useNavigate();

  const [problem, setProblem] = useState<
    | { reason: "no problem" }
    | {
        reason: "unknown credential";
        email: string;
      }
    | {
        reason: "could not sign in";
        email: string;
      }
  >({ reason: "no problem" });

  const { current: client } = useRef(
    ifClient(() => new Client(data.clientArgs))
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;

    const signin = async () => {
      const { token, error } = email
        ? await client.signinWithId(email)
        : await client.signinWithDiscoverable();

      if (token) {
        submit({ token }, { method: "POST" });
      } else if (error?.errorCode === "unknown_credential") {
        setProblem({ reason: "unknown credential", email });
      } else if (error?.errorCode === "unknown") {
        setProblem({ reason: "could not sign in", email });
      }
    };

    signin();
  };

  useEffect(() => {
    const f = async () => {
      const { token, error } = await client.signinWithAutofill();

      if (token) {
        submit({ token }, { method: "POST" });
      } else if (error) {
        if (error.errorCode === "unknown_credential") {
          setProblem({ reason: "unknown credential", email: "" });
        }
      }
    };

    f();
    return () => {
      client.abort();
    };
  }, [client, submit]);

  const handleRegister = (event: MouseEvent<HTMLButtonElement>) => {
    const form = event.currentTarget.closest("form");
    const formData = new FormData(form as HTMLFormElement);
    const email = formData.get("email")?.toString() ?? "";

    navigate(`/register-user?email=${encodeURIComponent(email)}`);
  };

  return (
    <main>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Sign in to your account
          </h2>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <Form onSubmit={handleSubmit} className="space-y-6" method="POST">
            <FormItem
              label={
                <label
                  htmlFor={form.email.id}
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Email address
                </label>
              }
              error={narrow([problem, "reason"], {
                "no problem": () => undefined,
                "could not sign in": ({ email }) => (
                  <>
                    Could not sign in. Is this a{" "}
                    <Link
                      to={`/register-device?email=${encodeURIComponent(email)}`}
                      className="font-semibold text-indigo-600 hover:text-indigo-500"
                    >
                      new device?
                    </Link>
                  </>
                ),
                "unknown credential": ({ email }) => (
                  <>
                    Unknown credential. Is this a{" "}
                    <Link
                      to={`/register-device?email=${encodeURIComponent(email)}`}
                      className="font-semibold text-indigo-600 hover:text-indigo-500"
                    >
                      new device?
                    </Link>
                  </>
                ),
              })}
            >
              <InputText
                autoComplete="webauthn"
                placeholder="Sign in with discoverable"
                disabled={navigation.state === "submitting"}
                {...form.email}
              />
            </FormItem>

            <div className="flex items-center gap-4">
              <Button primary className="w-full">
                Sign in
              </Button>
              <div>{" or "}</div>
              <Button secondary type="button" onClick={handleRegister}>
                Register
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </main>
  );
}

export const split = <
  const T extends string,
  C extends { [KEY in T]: (value: KEY) => any }
>(
  value: T extends keyof C ? T : keyof C,
  cases: C
): ReturnType<C[keyof C]> => {
  return cases[value](value as never);
};

export const narrow = <
  T extends Record<any, any>,
  K extends keyof T,
  C extends {
    [KEY in `${T[K]}`]: (
      value: T extends { [_ in K]: infer B }
        ? KEY extends B
          ? T
          : never
        : never
    ) => any;
  }
>(
  [o, p]: [T, K],
  cases: C
): ReturnType<C[keyof C]> => {
  return cases[o[p]](o as never);
};

const ifClient = <T,>(f: () => T): T => {
  return typeof window === "undefined" ? (undefined as T) : f();
};
