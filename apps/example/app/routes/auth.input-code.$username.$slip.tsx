import { type DataFunctionArgs } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import { Button } from "~/components/Button";
import { FormItem } from "~/components/FormItem";
import { InputText } from "~/components/InputText";
import type { FocusEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import { Client } from "@passwordlessdev/passwordless-client";

export async function loader({ params, context: { env } }: DataFunctionArgs) {
  const username = params.username;
  const slip = params.slip;

  if (!username || !slip) {
    throw new Response("Missing username or slip", { status: 422 });
  }

  return {
    username: decodeURIComponent(username),
    slip,
    clientArgs: {
      apiKey: env.PASSWORDLESS_PUBLIC_KEY,
      apiUrl: env.PASSWORDLESS_API_URL,
    },
  };
}

type ActionDataRegister = { success: boolean; token?: string };

export default function SignIn() {
  const {
    username,
    slip,
    clientArgs: { apiKey, apiUrl },
  } = useLoaderData<typeof loader>();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<"idle" | "failed" | "loading">("idle");
  const submit = useSubmit();
  const navigation = useNavigation();

  const registerDevice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    const tryRegister = async () => {
      setStatus("loading");
      const f = async () => {
        const response = await fetch("/auth/api?act=register-device", {
          method: "POST",
          body: new FormData(form),
        });

        const { token: rtoken } = await response.json<ActionDataRegister>();

        if (!rtoken) {
          return "failed";
        }

        const client = new Client({ apiKey, apiUrl });
        const { error, ...token } = await client.register(rtoken, username);

        if (error || !token.token) {
          return "failed";
        }

        submit(token, {
          action: "/auth/api?act=sign-in",
          method: "POST",
        });
      };

      const result = await f();
      if (result === "failed") {
        setStatus("failed");
      }
    };

    tryRegister();
  };

  const submitWhenFilled = (event: FormEvent<HTMLInputElement>) => {
    const codeLength = 6;
    event.currentTarget.value = event.currentTarget.value
      .replace(/[^\d]+/g, "")
      .slice(0, codeLength);

    if (event.currentTarget.value.length === codeLength) {
      buttonRef.current?.click();
    }
  };

  return (
    <main>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Input the code sent to {username}
          </h2>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <Form className="flex flex-col gap-4" onSubmit={registerDevice}>
            <input type="hidden" name="slip" defaultValue={slip} />
            <input type="hidden" name="username" defaultValue={username} />
            <FormItem
              error={
                status === "failed" && "Registration was aborted or invalid"
              }
            >
              <InputText
                name="code"
                type="text"
                readOnly={
                  status === "loading" || navigation.state === "submitting"
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="w-full text-center"
                onFocus={selectAllText}
                onInput={submitWhenFilled}
              />
            </FormItem>

            <Button
              loading={
                status === "loading" || navigation.state === "submitting"
              }
              ref={buttonRef}
              primary
            >
              Verify code
            </Button>
          </Form>
          <Link
            className="mt-10 block text-sm font-medium text-indigo-600 hover:underline"
            to="/auth/register"
          >
            Back to register
          </Link>
        </div>
      </div>
    </main>
  );
}

const selectAllText = (event: FocusEvent<HTMLInputElement>) => {
  event.currentTarget.setSelectionRange(0, event.currentTarget.value.length);
};
