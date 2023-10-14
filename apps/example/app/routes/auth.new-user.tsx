import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";
import { AlertError } from "~/components/AlertError";
import { Button } from "~/components/Button";
import { Dialog } from "~/components/Dialog";
import { InputText } from "~/components/InputText";
import { useNewUser } from "~/hooks/useNewUser";

export async function loader({ context: { env } }: DataFunctionArgs) {
  return {
    clientKey: env.AUTH_CLIENT_KEY,
  };
}

export default function SignIn() {
  const { submit, state, error } = useNewUser();

  function formatError(code: typeof error): React.ReactNode {
    switch (code) {
      case "error_unknown":
        return "There was an unknown error when trying to sign in. Please try again and see if it works.";
      case "new_user_failed":
        return "Most likely the user already exists. Please try a different username or email.";
    }

    return "Something has gone terribly wrong!";
  }

  return (
    <main className="flex h-full w-full">
      <Dialog>
        <h2 className="mb-2 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Create a new user
        </h2>
        <p className="mb-4 text-sm">
          After creating the user we will send you a verification code to your
          email to verify this device.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(new FormData(event.currentTarget));
          }}
        >
          <div className="mb-4 flex flex-col-reverse">
            <InputText
              autoFocus
              aria-labelledby="email"
              name="username"
              type="email"
              autoComplete="email"
              readOnly={state !== "idle"}
              placeholder="user@example.com"
              className="peer"
              required
            />
            <label
              id="email"
              className="text-sm font-semibold transition-opacity peer-focus:text-amber-800/70"
            >
              Email
            </label>
          </div>
          <div className="mb-4 flex flex-col-reverse">
            <InputText
              aria-labelledby="username"
              name="username"
              type="text"
              autoComplete="username"
              readOnly={state !== "idle"}
              placeholder="username"
              className="peer"
              required
            />
            <label
              id="username"
              className="text-sm font-semibold transition-opacity peer-focus:text-amber-800/70"
            >
              Username
            </label>
          </div>
          <Button primary loading={state !== "idle"} className="w-full">
            Create new user
          </Button>
          <AlertError show={error !== undefined} label="Breaking news!">
            {formatError(error)}
          </AlertError>
        </form>
        <p className="text-sm">
          Already have an account?{" "}
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
