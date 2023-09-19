import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { Link, useFetcher, useLoaderData, useSubmit } from "@remix-run/react";
import { Button } from "~/components/Button";
import { FormItem } from "~/components/FormItem";
import { InputText } from "~/components/InputText";
import { useEffect, useRef } from "react";
import { Client } from "@passwordlessdev/passwordless-client";

export async function loader({ context: { env } }: DataFunctionArgs) {
  return {
    clientArgs: {
      apiKey: env.PASSWORDLESS_PUBLIC_KEY,
      apiUrl: env.PASSWORDLESS_API_URL,
    },
  };
}

type ActionDataRequestCode = {
  success: boolean;
  slip?: string;
  reason?: "user taken" | "user missing" | "too many attempts";
  username?: string;
};

type ActionDataRegister = { success: boolean; token?: string };

export default function SignIn() {
  const {
    clientArgs: { apiKey, apiUrl },
  } = useLoaderData<typeof loader>();

  const code = useFetcher<ActionDataRequestCode>();

  const disabled = code.data?.success || code.state === "submitting";

  return (
    <main>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Register a new user or device
          </h2>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <code.Form
            method="POST"
            action="/auth/api?act=new-user"
            className="flex flex-col gap-4"
          >
            <input name="q" type="hidden" defaultValue="new-user" />
            <FormItem
              error={
                code.data?.success === false ? (
                  <>
                    {code.data.reason === "user missing" &&
                      "User is not registered"}
                    {code.data.reason === "user taken" &&
                      "User is already registered"}
                    {code.data.reason === "too many attempts" &&
                      "Too many attempts, try again later"}
                  </>
                ) : undefined
              }
            >
              <InputText
                name="email"
                readOnly={disabled}
                placeholder="user@example.com"
                required
                onChange={(event) => {
                  const el = event.currentTarget
                    .nextElementSibling as HTMLInputElement;
                  el.value = event.currentTarget.value;
                }}
              />
              <input type="hidden" name="username" defaultValue="" />
            </FormItem>
            <div className="flex items-center gap-4">
              <Button
                disabled={disabled}
                primary={!code.data?.success}
                tertiary={code.data?.success}
                className="flex-1"
              >
                New user
              </Button>
              <div>or</div>
              <Button
                disabled={disabled}
                secondary={!code.data?.success}
                tertiary={code.data?.success}
                formAction="/auth/api?act=new-device"
                formMethod="POST"
              >
                New device
              </Button>
            </div>
          </code.Form>
          {code.data?.success && code.data.username && code.data.slip && (
            <FormOneTimeCode
              username={code.data.username}
              slip={code.data.slip}
              client={{ apiKey, apiUrl }}
            />
          )}
          <Link
            className="mt-10 block text-sm font-medium text-indigo-600 hover:underline"
            to="/auth/sign-in"
          >
            Back to sign-in
          </Link>
        </div>
      </div>
    </main>
  );
}

type FormOneTimeCodeProps = {
  username: string;
  slip: string;
  client: { apiKey: string; apiUrl: string };
};

const FormOneTimeCode = ({
  username,
  slip,
  client: { apiKey, apiUrl },
}: FormOneTimeCodeProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const submit = useSubmit();
  const register = useFetcher<ActionDataRegister>();

  useEffect(() => {
    const registerToken = register.data?.token;

    if (!registerToken || !username) return;

    const registerAndSignIn = async () => {
      const client = new Client({ apiKey, apiUrl });

      const { token, error } = await client.register(registerToken, username);

      if (token) {
        const formData = new FormData();
        formData.set("token", token);
        submit(formData, { action: "/auth/api?act=sign-in", method: "POST" });
      } else {
        console.error(error);
      }
    };
    registerAndSignIn();
  }, [apiKey, apiUrl, username, register.data?.token, submit]);

  return (
    <register.Form
      key={slip}
      action="/auth/api?act=register-device"
      method="POST"
      className="mt-10 flex flex-col gap-4"
    >
      <input type="hidden" name="slip" defaultValue={slip} />
      <input type="hidden" name="username" defaultValue={username} />
      <FormItem label={<label>Code sent to {username}</label>}>
        <InputText
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          className="w-full text-center"
          onFocus={(event) => {
            event.currentTarget.setSelectionRange(0, 6);
          }}
          onInput={(event) => {
            const codeLength = 6;
            event.currentTarget.value = event.currentTarget.value
              .replace(/[^\d]+/g, "")
              .slice(0, codeLength);

            if (event.currentTarget.value.length === codeLength) {
              buttonRef.current?.click();
            }
          }}
        />
      </FormItem>

      <Button ref={buttonRef} primary>
        Register
      </Button>
    </register.Form>
  );
};
