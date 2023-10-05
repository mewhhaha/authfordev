import { Client } from "@mewhhaha/authfordev-client";
import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { Button } from "~/components/Button";
import { ButtonLink } from "~/components/ButtonLink";

export async function loader({ context: { env } }: DataFunctionArgs) {
  return {
    clientKey: env.AUTH_CLIENT_KEY,
  };
}

export default function SignIn() {
  const data = useLoaderData<{ clientKey: string }>();

  const [failure, setFailure] = useState(false);
  const signIn = useFetcher<{ success: boolean }>();

  const handleSignIn = async () => {
    setFailure(false);
    const client = Client(data);
    const { token, reason } = await client.signin();
    if (reason) {
      console.error(reason);
      setFailure(true);
    } else {
      signIn.submit(
        { token },
        { method: "POST", action: "/auth/api?act=sign-in" }
      );
    }
  };

  return (
    <main>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
          <div className="flex items-center gap-4">
            <Button
              loading={signIn.state === "submitting"}
              primary
              className="flex-1 whitespace-nowrap"
              onClick={handleSignIn}
            >
              Sign in
            </Button>
            <div>or</div>
            <ButtonLink to="/auth/register" secondary>
              Register
            </ButtonLink>
          </div>
          {failure && signIn.state === "idle" && (
            <p className="mt-4 w-full text-sm text-red-600">
              Failed to sign in. Is this a{" "}
              <Link
                className="whitespace-nowrap font-medium text-indigo-600 hover:underline"
                to={"/auth/register"}
              >
                new device?
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
