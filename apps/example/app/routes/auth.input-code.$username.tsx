import { type DataFunctionArgs } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import { Button } from "~/components/Button";
import { InputText } from "~/components/InputText";
import type { FocusEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import { Client } from "@mewhhaha/authfordev-client";

export async function loader({
  params,
  request,
  context: { env },
}: DataFunctionArgs) {
  const username = decodeURIComponent(params.username as string);
  const challenge = new URL(request.url).searchParams.get("challenge");

  if (!challenge || !username) {
    throw new Response("Missing token or username", { status: 422 });
  }

  return {
    username,
    challenge,
    clientKey: env.AUTH_CLIENT_KEY,
  };
}

export default function SignIn() {
  const { challenge, username, clientKey } = useLoaderData<typeof loader>();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<"idle" | "failed" | "loading">("idle");
  const submit = useSubmit();
  const navigation = useNavigation();

  const registerDevice = (event: FormEvent<HTMLFormElement>) => {
    console.log("STARTED FROM THE BOTTOM");
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const tryRegister = async () => {
      setStatus("loading");
      const f = async () => {
        const client = Client({ clientKey });
        const code = form.get("code") as string;
        const { token, reason } = await client.register(
          challenge,
          code,
          username
        );

        if (reason) {
          return "failed";
        }

        submit(
          { token },
          {
            action: "/auth/api?act=register-device",
            method: "POST",
          }
        );
      };

      const result = await f();
      if (result === "failed") {
        setStatus("failed");
      }
    };

    tryRegister();
  };

  const submitWhenFilled = (event: FormEvent<HTMLInputElement>) => {
    const codeLength = 8;
    event.currentTarget.value = event.currentTarget.value.slice(0, codeLength);

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
            <input type="hidden" name="username" defaultValue={username} />
            <div>
              <InputText
                name="code"
                type="text"
                readOnly={
                  status === "loading" || navigation.state === "submitting"
                }
                autoComplete="one-time-code"
                placeholder="000000"
                className="w-full text-center"
                onFocus={selectAllText}
                onInput={submitWhenFilled}
              />
              {status === "failed" && (
                <p className="mt-1 text-sm text-red-600">
                  Registration was aborted or invalid
                </p>
              )}
            </div>

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
