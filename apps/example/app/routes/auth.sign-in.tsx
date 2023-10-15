import { type DataFunctionArgs } from "@remix-run/cloudflare";
import {
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";
import { Button } from "~/components/Button";
import { AlertError } from "~/components/AlertError";
import { useSignIn } from "~/hooks/useSignin";
import { Dialog } from "~/components/Dialog";
import type { FocusEvent, FormEvent } from "react";
import { useId, useRef } from "react";
import { cn } from "~/css/cn";
import { useNewUser } from "~/hooks/useNewUser";
import { InputText } from "~/components/InputText";
import { useNewDevice } from "~/hooks/useNewDevice";
import { useRegisterDevice } from "~/hooks/useRegisterDevice";

export async function loader({ request, context: { env } }: DataFunctionArgs) {
  const url = new URL(request.url);
  const defaultTab = url.searchParams.get("tab") ?? "sign-in";
  const defaultUsername = decodeURIComponent(
    url.searchParams.get("username") ?? ""
  );
  const challenge = url.searchParams.get("challenge");

  return {
    clientKey: env.AUTH_CLIENT_KEY,
    defaultTab,
    defaultUsername,
    challenge,
  };
}

export default function SignIn() {
  const { challenge, defaultTab, defaultUsername, clientKey } =
    useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  return (
    <main className="flex h-full w-full">
      <Dialog>
        <fieldset
          defaultValue="signin"
          className="space-y-4 p-2"
          onChange={(event) => {
            const tabs =
              event.currentTarget.querySelectorAll<HTMLInputElement>(
                "input[name=tab]"
              );

            for (const tab of tabs) {
              if (tab.checked) {
                setSearchParams(
                  (prev) => {
                    prev.set("tab", tab.value);
                    return prev;
                  },
                  { replace: true }
                );
                break;
              }
            }
          }}
        >
          {challenge && (
            <Tab label="Input code" value="input-code" defaultChecked>
              <VerifyDevice
                challenge={challenge}
                clientKey={clientKey}
                username={defaultUsername}
                className="pb-4 pl-12 pr-4 pt-2"
              />
            </Tab>
          )}
          <Tab
            label="Sign in"
            value="sign-in"
            defaultChecked={defaultTab === "sign-in"}
          >
            <Signin clientKey={clientKey} className="pb-4 pl-12 pr-4 pt-2" />
          </Tab>
          <Tab
            label="Create user"
            value="new-user"
            defaultChecked={defaultTab === "new-user"}
          >
            <CreateUser className="pb-4 pl-12 pr-4 pt-2" />
          </Tab>
          <Tab
            label="Register device"
            value="new-device"
            defaultChecked={defaultTab === "new-device"}
          >
            <RegisterDevice
              defaultUsername={defaultUsername}
              className="pb-4 pl-12 pr-4 pt-2"
            />
          </Tab>
        </fieldset>
      </Dialog>
    </main>
  );
}

/**
 * This is the content of different tags
 */
type SigninProps = { clientKey: string } & JSX.IntrinsicElements["section"];

const Signin = ({ clientKey, ...props }: SigninProps) => {
  const navigate = useNavigate();
  let { submit, state, error } = useSignIn(clientKey, { navigate });

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
    <section {...props}>
      <Button
        loading={state === "submitting"}
        primary
        icon={<FingerPrintIcon />}
        className="w-full"
        onClick={submit}
      >
        Authenticate
      </Button>

      <AlertError show={error !== undefined} label="Breaking news!">
        {formatError(error)}
      </AlertError>

      <DividerText>or</DividerText>

      <p className="text-sm">
        Can't sign in?{" "}
        <Link
          to="/auth/sign-in?tab=new-device"
          replace
          reloadDocument
          className="font-semibold text-amber-600 hover:text-amber-500 hover:underline"
        >
          Register this device.
        </Link>
      </p>
    </section>
  );
};

const CreateUser = (props: JSX.IntrinsicElements["section"]) => {
  const navigate = useNavigate();
  const { submit, state, error } = useNewUser({ navigate });

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
    <section {...props}>
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
      <DividerText>or</DividerText>
      <p className="text-sm">
        Already have an account?{" "}
        <Link
          to="/auth/sign-in?tab=sign-in"
          replace
          reloadDocument
          className="font-semibold text-amber-600 hover:text-amber-500 hover:underline"
        >
          Sign in.
        </Link>
      </p>
    </section>
  );
};

type RegisterDeviceProps = {
  defaultUsername: string;
} & JSX.IntrinsicElements["section"];

const RegisterDevice = ({ defaultUsername, ...props }: RegisterDeviceProps) => {
  const navigate = useNavigate();
  const { state, submit, error } = useNewDevice({ navigate });

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
    <section {...props}>
      <p className="mb-4 text-sm">
        We will send you a verification code to your email to verify this
        device.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget));
        }}
      >
        <div className="mb-4 flex flex-col-reverse">
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
        <Button primary loading={state !== "idle"} className="w-full">
          Send verification code
        </Button>
        <AlertError show={error !== undefined} label="Breaking news!">
          {formatError(error)}
        </AlertError>
      </form>
      <DividerText>or</DividerText>
      <p className="text-sm">
        Already registered this device?{" "}
        <Link
          to="/auth/sign-in?tab=sign-in"
          replace
          reloadDocument
          className="font-semibold text-amber-600 hover:text-amber-500 hover:underline"
        >
          Sign in.
        </Link>
      </p>
    </section>
  );
};

type VerifyDeviceProps = {
  challenge: string;
  username: string;
  clientKey: string;
} & JSX.IntrinsicElements["section"];

const VerifyDevice = ({
  challenge,
  username,
  clientKey,
  ...props
}: VerifyDeviceProps) => {
  const navigate = useNavigate();
  const { submit, state, error } = useRegisterDevice(clientKey, { navigate });

  const buttonRef = useRef<HTMLButtonElement>(null);

  const submitWhenFilled = (event: FormEvent<HTMLInputElement>) => {
    const codeLength = 8;
    event.currentTarget.value = event.currentTarget.value.slice(0, codeLength);

    if (event.currentTarget.value.length === codeLength) {
      buttonRef.current?.click();
    }
  };

  return (
    <section {...props}>
      <p className="mb-4 min-w-0 text-sm">
        An input code was sent to the email of{" "}
        <div className="truncate" title={username}>
          {username}
        </div>
      </p>
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
      <DividerText>or</DividerText>
      <p className="text-sm">
        Code never arrived?{" "}
        <Link
          to={`/auth/sign-in?tab=new-device&username=${encodeURIComponent(
            username
          )}`}
          className="font-semibold text-amber-600 hover:text-amber-500 hover:underline"
        >
          Send code again.
        </Link>
      </p>
    </section>
  );
};

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

const FingerPrintIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33"
      />
    </svg>
  );
};

const selectAllText = (event: FocusEvent<HTMLInputElement>) => {
  event.currentTarget.setSelectionRange(0, event.currentTarget.value.length);
};

type TabProps = {
  children: React.ReactNode;
  label: React.ReactNode;
  value: string;
  defaultChecked?: boolean;
};

const Tab = ({ children, label, value, defaultChecked }: TabProps) => {
  const id = useId();
  return (
    <div className="relative isolate flex flex-wrap items-center overflow-hidden border-black">
      <input
        id={id}
        name="tab"
        type="radio"
        value={value}
        className="peer mx-2 border-black checked:bg-black hover:checked:bg-black focus:outline-black checked:focus:bg-black"
        defaultChecked={defaultChecked}
      />
      <label
        htmlFor={id}
        className={cn(
          "mb-2 mr-2 block flex-1 rounded-r-lg border-y border-r border-black py-2 pl-2 text-xl font-bold",
          "peer-checked:bg-black peer-checked:text-white",
          "shadow-[4px_0px_0px_0px_rgba(0,0,0,1)] transition-[transform,box-shadow]",
          "hover:translate-x-[2px] hover:cursor-pointer hover:bg-gray-200 hover:shadow-[2px_0px_0px_0px_rgba(0,0,0,1)]",
          "focus-visible:shadow-none peer-checked:translate-x-[4px] peer-checked:shadow-none"
        )}
      >
        {label}
      </label>
      <br />
      <div className="invisible -z-10 max-h-0 w-full transition-all duration-300 ease-in-out peer-checked:visible peer-checked:max-h-[500px] peer-checked:translate-y-0">
        {children}
      </div>
    </div>
  );
};
