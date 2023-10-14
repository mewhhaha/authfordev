import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { Button } from "~/components/Button";
import { AlertError } from "~/components/AlertError";
import { useSignIn } from "~/hooks/useSignin";
import { Dialog } from "~/components/Dialog";

export async function loader({ context: { env } }: DataFunctionArgs) {
  return {
    clientKey: env.AUTH_CLIENT_KEY,
  };
}

export default function SignIn() {
  const data = useLoaderData<{ clientKey: string }>();
  let { submit, state, error } = useSignIn(data.clientKey);

  const formatError = (code: typeof error) => {
    switch (code) {
      case "error_unknown":
        return "There was an unknown error when trying to sign in. Please try again and see if it works.";
      case "signin_aborted":
        return "The sign in process was aborted. Please try again and see if it works.";
      case "signin_failed":
        return (
          <>
            The sign in process failed. Perhaps you need to{" "}
            <Link
              className="whitespace-nowrap font-medium text-indigo-600 hover:underline"
              to={"/auth/register"}
            >
              register this device?
            </Link>
          </>
        );
    }

    return "Something has gone terribly wrong!";
  };

  return (
    <main className="flex h-full w-full">
      <Dialog>
        <h2 className="mb-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Sign in to your account
        </h2>
        <Button
          autoFocus
          loading={state === "submitting"}
          primary
          className="w-full"
          onClick={submit}
        >
          Sign in
        </Button>

        <AlertError show={error !== undefined} label="Breaking news!">
          {formatError(error)}
        </AlertError>

        <div className="relative my-4 flex flex-none items-center">
          <div aria-hidden className="h-px flex-1 bg-gray-300" />
          <div className="px-4">or</div>
          <div aria-hidden className="h-px flex-1 bg-gray-300" />
        </div>

        <Button as={Link} to="/auth/new-user" secondary className="mb-4">
          New user
        </Button>
        <p className="text-sm">
          Can't sign in?{" "}
          <Link
            to="/auth/new-device"
            className="font-semibold text-amber-600 hover:text-amber-500 hover:underline"
          >
            Register this device.
          </Link>
        </p>
      </Dialog>
    </main>
  );
}
