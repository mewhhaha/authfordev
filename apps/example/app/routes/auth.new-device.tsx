import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { AlertError } from "~/components/AlertError";
import { Button } from "~/components/Button";
import { Dialog } from "~/components/Dialog";
import { InputText } from "~/components/InputText";
import { useNewDevice } from "~/hooks/useNewDevice";

export async function loader({ request, context: { env } }: DataFunctionArgs) {
  const url = new URL(request.url);
  const defaultUsername = url.searchParams.get("username");

  return {
    defaultUsername: defaultUsername
      ? decodeURIComponent(defaultUsername)
      : undefined,
  };
}

type ActionDataRequestCode = {
  success: boolean;
  slip?: string;
  reason?: "user_taken" | "user_missing";
  username?: string;
};

export default function SignIn() {
  const { defaultUsername } = useLoaderData<typeof loader>();
  const register = useFetcher<ActionDataRequestCode>();
  const { state, submit, error } = useNewDevice();

  function formatError(code: typeof error): React.ReactNode {
    switch (code) {
      case "error_unknown":
        return "There was an unknown error when trying to sign in. Please try again and see if it works.";
      case "new_device_failed":
        return "Most likely the user doesn't exist. Please check that the username is written correctly.";
    }

    return "Something has gone terribly wrong!";
  }

  return (
    <main className="flex h-full w-full">
      <Dialog>
        <h2 className="mb-2 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Register this device
        </h2>
        <p className="mb-4 text-sm">
          We will send you a verification code to your email to verify this
          device.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(new FormData(event.currentTarget));
          }}
          className="mb-4 flex flex-col gap-4"
        >
          <div className="flex flex-col-reverse">
            <InputText
              name="username"
              type="text"
              autoComplete="username"
              readOnly={state !== "idle"}
              placeholder="username"
              defaultValue={defaultUsername}
              required
            />
            <label
              id="username"
              className="text-sm font-semibold transition-opacity peer-focus:text-amber-800/70"
            >
              Username
            </label>
          </div>
          <Button
            primary
            loading={
              register.state !== "idle" &&
              register.formAction?.includes("new-device")
            }
            className="w-full"
          >
            Send verification code
          </Button>
          <AlertError show={error !== undefined} label="Breaking news!">
            {formatError(error)}
          </AlertError>
        </form>
        <p className="text-sm">
          Already registered this device?{" "}
          <Link
            to="/auth/sign-in"
            className="font-semibold text-amber-600 hover:text-amber-500 hover:underline"
          >
            Sign in.
          </Link>
        </p>
      </Dialog>
    </main>
  );
}
