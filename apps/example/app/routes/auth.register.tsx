import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { Link, useFetcher } from "@remix-run/react";
import { Button } from "~/components/Button";
import { InputText } from "~/components/InputText";

export async function loader({ context: { env } }: DataFunctionArgs) {
  return {
    clientKey: env.AUTH_CLIENT_KEY,
  };
}

type ActionDataRequestCode = {
  success: boolean;
  slip?: string;
  reason?: "user_taken" | "user_missing";
  username?: string;
};

export default function SignIn() {
  const register = useFetcher<ActionDataRequestCode>();

  return (
    <main>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Register a new user or device
          </h2>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <register.Form
            method="POST"
            action="/auth/api?act=new-user"
            className="flex flex-col gap-4"
          >
            <div>
              <InputText
                name="username"
                type="email"
                autoComplete="webauthn"
                readOnly={register.state !== "idle"}
                placeholder="user@example.com"
                required
              />
              {register.data?.success === false && (
                <p className="mt-1 text-sm text-red-600">
                  {register.data.reason === "user_taken" &&
                    "Username already taken"}
                  {register.data.reason === "user_missing" && "User not found"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Button
                primary
                loading={
                  register.state !== "idle" &&
                  register.formAction?.includes("new-user")
                }
                className="flex-1"
              >
                New user
              </Button>
              <div>or</div>
              <Button
                secondary
                loading={
                  register.state !== "idle" &&
                  register.formAction?.includes("new-device")
                }
                formAction="/auth/api?act=new-device"
                formMethod="POST"
              >
                New device
              </Button>
            </div>
          </register.Form>
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
