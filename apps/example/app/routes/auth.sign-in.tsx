import { Client } from "@passwordlessdev/passwordless-client";
import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { Link, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { Button } from "~/components/Button";

export async function loader({ context: { env } }: DataFunctionArgs) {
  return {
    clientArgs: {
      apiKey: env.PASSWORDLESS_PUBLIC_KEY,
      apiUrl: env.PASSWORDLESS_API_URL,
    },
  };
}

export default function SignIn() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [failure, setFailure] = useState(false);
  const signIn = useFetcher<{ success: boolean }>();

  const handleSignIn = async () => {
    setFailure(false);
    const client = new Client(data.clientArgs);
    const { token, error } = await client.signinWithDiscoverable();
    if (error) {
      console.error(error);
      setFailure(true);
    } else {
      signIn.submit(
        { token },
        { method: "POST", action: "/auth/api?act=sign-in" }
      );
    }
  };

  let status: "idle" | "loading" | "failed" = "idle";
  if (signIn.state === "submitting") {
    status = "loading";
  } else if (failure || signIn.data?.success === false) {
    status = "failed";
  }

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
              loading={status === "loading"}
              primary
              className="flex-1 whitespace-nowrap"
              onClick={handleSignIn}
            >
              Sign in
            </Button>
            <div>or</div>
            <Button secondary onClick={() => navigate("/auth/register")}>
              Register
            </Button>
          </div>
          {status === "failed" && (
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
