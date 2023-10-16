import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import type {
  ComponentProps,
  FocusEvent,
  FormEvent,
  JSXElementConstructor,
} from "react";
import { forwardRef, useId, useRef, useState } from "react";
import { cn } from "~/css/cn";
import { endpoint } from "~/auth/endpoint.server";
import { useWebAuthn } from "~/auth/useWebAuthn";

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

export async function action({ request, context: { env } }: DataFunctionArgs) {
  return endpoint({
    request,
    secrets: env.SECRET_FOR_AUTH,
    origin: env.ORIGIN,
    serverKey: env.AUTH_SERVER_KEY,
    redirects: {
      success: () => "/",
      signin: () => "/auth",
      signout: () => "/",
      challenge: (username, token) =>
        `/auth?tab=verify-device&username=${encodeURIComponent(
          username
        )}&challenge=${token}`,
    },
  });
}

export default function SignIn() {
  const { challenge, defaultTab, defaultUsername, clientKey } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const persistTabInSearchParams = (event: FormEvent<HTMLFieldSetElement>) => {
    const tabs =
      event.currentTarget.querySelectorAll<HTMLInputElement>("input[name=tab]");

    for (const tab of tabs) {
      if (tab.checked) {
        if (searchParams.get("tab") === tab.value) break;
        searchParams.set("tab", tab.value);
        setSearchParams(searchParams, { replace: true });
        break;
      }
    }
  };

  return (
    <main className="flex h-full w-full items-center sm:items-start">
      <Dialog>
        <fieldset
          defaultValue="signin"
          className="flex flex-col gap-4 p-2"
          onChange={persistTabInSearchParams}
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
            <CreateUser
              clientKey={clientKey}
              className="pb-4 pl-12 pr-4 pt-2"
            />
          </Tab>
          <Tab
            label="Register device"
            value="new-device"
            defaultChecked={defaultTab === "new-device"}
          >
            <RegisterDevice
              clientKey={clientKey}
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
  let {
    signin: { submit, state, error },
  } = useWebAuthn(clientKey);

  return (
    <section {...props}>
      <Form method="POST" onSubmit={submit}>
        <Button
          loading={state === "submitting"}
          primary
          icon={<FingerPrintIcon />}
          className="w-full"
        >
          Authenticate
        </Button>
      </Form>

      <AlertError show={error}>
        The sign in process failed. Perhaps you need to{" "}
        <Link
          className="whitespace-nowrap font-medium text-indigo-600 hover:underline"
          to={"/auth?tab=new-device"}
        >
          register this device?
        </Link>
      </AlertError>

      <DividerText>or</DividerText>

      <p className="text-sm">
        Can't sign in?{" "}
        <Link
          to="/auth?tab=new-device"
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

type CreateUserProps = { clientKey: string } & JSX.IntrinsicElements["section"];

const CreateUser = ({ clientKey, ...props }: CreateUserProps) => {
  const {
    create: { submit, state, error },
  } = useWebAuthn(clientKey);

  return (
    <section {...props}>
      <p className="mb-4 text-sm">
        After creating the user we will send you a verification code to your
        email to verify this device.
      </p>
      <Form method="POST" onSubmit={submit}>
        <div className="mb-4 flex flex-col-reverse">
          <InputText
            autoFocus
            aria-labelledby="create.email"
            name="email"
            type="email"
            autoComplete="email"
            readOnly={state !== "idle"}
            placeholder="user@example.com"
            className="peer"
            required
          />
          <label
            id="create.email"
            className="text-sm font-semibold transition-opacity peer-focus:text-amber-800/70"
          >
            Email
          </label>
        </div>
        <div className="mb-4 flex flex-col-reverse">
          <InputText
            aria-labelledby="create.username"
            name="username"
            type="text"
            autoComplete="username"
            readOnly={state !== "idle"}
            placeholder="username"
            className="peer"
            required
          />
          <label
            id="create.username"
            className="text-sm font-semibold transition-opacity peer-focus:text-amber-800/70"
          >
            Username
          </label>
        </div>
        <Button primary loading={state !== "idle"} className="w-full">
          Create new user
        </Button>
        <AlertError show={error}>
          Most likely the user already exists. Please try a different username
          or email.
        </AlertError>
      </Form>
      <DividerText>or</DividerText>
      <p className="text-sm">
        Already have an account?{" "}
        <Link
          to="/auth?tab=sign-in"
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
  clientKey: string;
  defaultUsername: string;
} & JSX.IntrinsicElements["section"];

const RegisterDevice = ({
  clientKey,
  defaultUsername,
  ...props
}: RegisterDeviceProps) => {
  const {
    register: { state, submit, error },
  } = useWebAuthn(clientKey);

  return (
    <section {...props}>
      <p className="mb-4 text-sm">
        We will send you a verification code to your email to verify this
        device.
      </p>
      <Form method="POST" onSubmit={submit}>
        <div className="mb-4 flex flex-col-reverse">
          <InputText
            name="username"
            aria-labelledby="register.username"
            type="text"
            autoComplete="username"
            readOnly={state !== "idle"}
            placeholder="username"
            defaultValue={defaultUsername}
            required
            className="peer"
          />
          <label
            id="register.username"
            className="text-sm font-semibold transition-opacity peer-focus:text-amber-800/70"
          >
            Username
          </label>
        </div>
        <Button primary loading={state !== "idle"} className="w-full">
          Send verification code
        </Button>
        <AlertError show={error}>
          Most likely the user doesn't exist. Please check that the username is
          written correctly.
        </AlertError>
      </Form>
      <DividerText>or</DividerText>
      <p className="text-sm">
        Already registered this device?{" "}
        <Link
          to="/auth?tab=sign-in"
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
  const {
    verify: { submit, state, error },
  } = useWebAuthn(clientKey);

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
        <span className="truncate font-bold" title={username}>
          {username}
        </span>
      </p>
      <Form method="POST" onSubmit={submit}>
        <input type="hidden" name="challenge" defaultValue={challenge} />
        <input type="hidden" name="username" defaultValue={username} />
        <div className="mb-4 flex flex-col-reverse">
          <InputText
            id="one-time-code"
            name="code"
            type="text"
            readOnly={state === "submitting"}
            autoComplete="one-time-code"
            placeholder="ABCD0123"
            className="mb-4 w-full text-center"
            onFocus={selectAllText}
            onInput={submitWhenFilled}
          />
          <label
            id="one-time-code"
            className="text-sm font-semibold transition-opacity peer-focus:text-amber-800/70"
          >
            One time code
          </label>
        </div>

        <Button
          loading={state === "submitting"}
          ref={buttonRef}
          primary
          className="w-full"
        >
          Register device
        </Button>
        <AlertError show={error}>Registration failed or was aborted</AlertError>
      </Form>
      <DividerText>or</DividerText>
      <p className="text-sm">
        Code never arrived?{" "}
        <Link
          to={`/auth?tab=new-device&username=${encodeURIComponent(username)}`}
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
      <div className="invisible -z-10 max-h-0 w-full transition-all duration-300 ease-in-out peer-checked:visible peer-checked:max-h-[500px]">
        {children}
      </div>
    </div>
  );
};

/** AlertError Component */

type AlertErrorProps = {
  show?: boolean;
  children: React.ReactNode;
};

const AlertError = ({ show, children }: AlertErrorProps) => {
  return (
    <div
      aira-live="polite"
      className={cn(
        "flex bg-red-200/50 px-4 py-2 text-sm text-red-600 ring ring-inset ring-red-50",
        "transition-opacity",
        show ? "visible h-auto opacity-100" : "hidden h-0 opacity-0"
      )}
    >
      <div className="flex items-center pr-2">
        <ExclamationTriangleIcon />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
};

const ExclamationTriangleIcon = () => {
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
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
};

/** Button component */

type ButtonProps<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button"
> = {
  as?: T;
  icon?: React.ReactNode;
  loading?: boolean;
} & (
  | { primary: boolean; secondary?: boolean }
  | { primary?: boolean; secondary: boolean }
) &
  (T extends keyof JSX.IntrinsicElements
    ? JSX.IntrinsicElements[T]
    : ComponentProps<T>);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      icon,
      primary,
      as: Component = "button",
      secondary,
      loading,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Component
        ref={ref}
        {...props}
        aria-disabled={loading}
        onClick={loading ? undefined : props.onClick}
        className={cn(
          {
            "bg-amber-400 hover:bg-amber-500 focus-visible:bg-amber-500":
              primary,
            "bg-white hover:bg-gray-100 focus-visible:bg-gray-100": secondary,
          },
          "my-2 flex items-center justify-center rounded-lg border-2 border-black px-3 py-1.5 text-sm font-bold leading-6 text-gray-900",
          "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-[transform,box-shadow]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          "focus-visible:translate-x-[2px] focus-visible:translate-y-[2px] focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          "active:translate-x-[3px] active:translate-y-[3px] active:bg-black active:text-white active:shadow-none",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
          "disabled:bg-gray-100 disabled:text-black disabled:hover:bg-gray-100",
          props.className
        )}
      >
        <div className="flex items-center gap-1">
          {loading && <div className="animate-pulse">...</div>}
          {icon && <div>{icon}</div>}
          {children}
        </div>
      </Component>
    );
  }
) as (<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button"
>(
  props: ButtonProps<T>
) => JSX.Element) & { displayName?: string };

Button.displayName = "Button";

/** Dialog component  */
const Dialog = forwardRef<HTMLDialogElement, JSX.IntrinsicElements["dialog"]>(
  (props, ref) => {
    return (
      <dialog
        ref={ref}
        open
        {...props}
        className={cn(
          "relative mx-auto my-10 w-full max-w-sm rounded-md border-black bg-white ring-amber-200 sm:mt-20 sm:border-4 sm:ring-4",
          props.className
        )}
      />
    );
  }
);

Dialog.displayName = "Dialog";

/** Input Text component */

const InputText = (props: JSX.IntrinsicElements["input"]) => {
  return (
    <input
      {...props}
      className={cn(
        "block w-full rounded-md border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] placeholder:font-bold focus:border-2 focus:border-black",
        "transition-[transform,box-shadow] focus-visible:translate-x-[4px] focus-visible:translate-y-[4px] focus-visible:shadow-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
        props.className
      )}
    />
  );
};
