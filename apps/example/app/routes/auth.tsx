import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { endpoint } from "@mewhhaha/authfor-remix/endpoint.server";
import { Button } from "~/components/Button.js";
import { Dialog } from "~/components/Dialog.js";
import { InputText } from "~/components/InputText.js";
import { cookieStorage } from "~/auth/session.server.js";
import { FormSignIn, FormSignUp } from "@mewhhaha/authfor-remix";

export async function loader({ context: { env } }: DataFunctionArgs) {
  return {
    clientKey: env.AUTH_CLIENT_KEY,
  };
}

export async function action({ request, context: { env } }: DataFunctionArgs) {
  return endpoint(env.AUTH_SERVER_KEY, {
    request,
    origin: env.ORIGIN,
    session: {
      data: (user) => user,
      storage: cookieStorage,
      secrets: env.SECRET_FOR_AUTH,
    },
    redirects: {
      signup: () => "/home",
      signin: () => "/home",
      signout: () => "/home",
    },
  });
}

export function shouldRevalidate() {
  return false;
}

export default function Page() {
  const { clientKey } = useLoaderData<typeof loader>();

  return (
    <main className="flex h-full w-full items-center sm:items-start">
      <Dialog>
        <h1 className="mb-10 text-center text-2xl font-extrabold tracking-wider">
          Sign up or sign in to the
          <br /> example application!
        </h1>
        <FormSignUp taken="Username taken" clientKey={clientKey}>
          {({ state, error }) => {
            return (
              <>
                <fieldset className="group mb-4">
                  <label
                    id="username"
                    className="text-sm font-semibold transition-opacity group-focus-within:text-amber-600 peer-focus:text-amber-800/70"
                  >
                    Username
                  </label>
                  <InputText
                    as={FormSignUp.Username}
                    maxLength={60}
                    placeholder="Enter your username"
                    aria-labelledby="username"
                    className="peer"
                  />
                </fieldset>
                <Button
                  loading={state !== "idle"}
                  kind="secondary"
                  className="w-full"
                >
                  Sign up
                </Button>
                {error && (
                  <p className="group/error:block hidden text-sm text-red-600">
                    Failed to sign up.
                  </p>
                )}
              </>
            );
          }}
        </FormSignUp>
        <DividerText>or</DividerText>
        <FormSignIn immediately clientKey={clientKey} method="POST">
          {({ state, error }) => {
            return (
              <>
                <Button
                  kind="primary"
                  loading={state !== "idle"}
                  className="w-full"
                >
                  Sign in with passkey
                </Button>
                {error && (
                  <p className="text-sm text-red-600">Failed to sign in.</p>
                )}
              </>
            );
          }}
        </FormSignIn>
      </Dialog>
    </main>
  );
}

/**
 * These are helper components
 */

type DividerTextProps = { children: React.ReactNode };

const DividerText = ({ children }: DividerTextProps) => {
  return (
    <div className="relative my-4 flex flex-none items-center">
      <div aria-hidden className="h-px flex-1 bg-gray-300" />
      <div className="px-4">{children}</div>
      <div aria-hidden className="h-px flex-1 bg-gray-300" />
    </div>
  );
};
