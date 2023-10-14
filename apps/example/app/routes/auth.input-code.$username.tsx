import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { Button } from "~/components/Button";
import { InputText } from "~/components/InputText";
import type { FocusEvent, FormEvent } from "react";
import { useRef } from "react";
import { useRegisterDevice } from "~/hooks/useRegisterDevice";
import { Dialog } from "~/components/Dialog";
import { AlertError } from "~/components/AlertError";

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

  const { submit, state, error } = useRegisterDevice(clientKey);

  const buttonRef = useRef<HTMLButtonElement>(null);

  const submitWhenFilled = (event: FormEvent<HTMLInputElement>) => {
    const codeLength = 8;
    event.currentTarget.value = event.currentTarget.value.slice(0, codeLength);

    if (event.currentTarget.value.length === codeLength) {
      buttonRef.current?.click();
    }
  };

  return (
    <main className="flex h-full w-full">
      <Dialog>
        <h2 className="mb-10 min-w-0 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Input code sent to{" "}
          <div className="truncate" title={username}>
            {username}
          </div>
        </h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(new FormData(event.currentTarget));
          }}
        >
          <input type="hidden" name="challenge" defaultValue={challenge} />
          <input type="hidden" name="username" defaultValue={username} />
          <InputText
            name="code"
            type="text"
            readOnly={state === "submitting"}
            autoComplete="one-time-code"
            placeholder="ABCD0123"
            className="mb-4 w-full text-center"
            onFocus={selectAllText}
            onInput={submitWhenFilled}
          />
          <Button
            loading={state === "submitting"}
            ref={buttonRef}
            primary
            className="w-full"
          >
            Register device
          </Button>
          <AlertError label="Breaking news!" show={error !== undefined}>
            Registration failed or was aborted
          </AlertError>
        </form>
        <p className="text-sm">
          Code never arrived?{" "}
          <Link
            to={`/auth/new-device?username=${encodeURIComponent(username)}`}
            className="font-semibold text-amber-600 hover:text-amber-500 hover:underline"
          >
            Send code again.
          </Link>
        </p>
      </Dialog>
    </main>
  );
}

const selectAllText = (event: FocusEvent<HTMLInputElement>) => {
  event.currentTarget.setSelectionRange(0, event.currentTarget.value.length);
};
