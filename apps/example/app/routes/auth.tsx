import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { Form, useLoaderData } from "@remix-run/react";
import type { ComponentProps, JSXElementConstructor } from "react";
import { forwardRef } from "react";
import { cn } from "~/css/cn";
import { endpoint } from "~/auth/endpoint.server";
import { useWebauthn } from "~/auth/useWebauthn";

export async function loader({ context: { env } }: DataFunctionArgs) {
  return {
    clientKey: env.AUTH_CLIENT_KEY,
  };
}

export async function action({ request, context: { env } }: DataFunctionArgs) {
  return endpoint(env.AUTH_SERVER_KEY, {
    request,
    secrets: env.SECRET_FOR_AUTH,
    origin: env.ORIGIN,
    session: { data: (user) => user },
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

  const { signin, signup, aliases } = useWebauthn(clientKey);

  return (
    <main className="flex h-full w-full items-center sm:items-start">
      <Dialog>
        <h1 className="mb-10 text-center text-2xl font-extrabold tracking-wider">
          Sign up or sign in to the
          <br /> example application!
        </h1>
        <Form
          onSubmit={signup.submit}
          method="POST"
          onChange={(event) => {
            if (event.currentTarget.checkValidity()) {
              aliases.submit(event);
            }
          }}
        >
          <div className="mb-4 flex flex-col-reverse">
            <InputText
              aria-labelledby="username"
              name="username"
              type="text"
              autoComplete="username"
              minLength={2}
              maxLength={60}
              readOnly={signup.state !== "idle"}
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
          {aliases.error && (
            <p className="text-red-600">Try another username</p>
          )}
          <Button
            kind="secondary"
            loading={signup.state !== "idle" || aliases.state !== "idle"}
            className="w-full"
          >
            Sign up
          </Button>
        </Form>
        <DividerText>or</DividerText>
        <Form onSubmit={signin.submit} method="POST">
          <Button
            kind="primary"
            loading={signin.state !== "idle"}
            className="w-full"
          >
            Sign in with passkey
          </Button>
          {/* <AlertError>
            Failed to sign in. Do you need to{" "}
            <a href="#">recover your passkey?</a>
          </AlertError> */}
        </Form>
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

/** AlertError Component */

// type AlertErrorProps = {
//   show?: boolean;
//   children: React.ReactNode;
// };

// const AlertError = ({ show, children }: AlertErrorProps) => {
//   return (
//     <div
//       aira-live="polite"
//       className={cn(
//         "flex bg-red-200/50 px-4 py-2 text-sm text-red-600 ring ring-inset ring-red-50",
//         "transition-opacity",
//         show ? "visible h-auto opacity-100" : "hidden h-0 opacity-0"
//       )}
//     >
//       <div className="flex items-center pr-2">
//         <ExclamationTriangleIcon />
//       </div>
//       <div className="flex-1">{children}</div>
//     </div>
//   );
// };

// const ExclamationTriangleIcon = () => {
//   return (
//     <svg
//       xmlns="http://www.w3.org/2000/svg"
//       fill="none"
//       viewBox="0 0 24 24"
//       strokeWidth={1.5}
//       stroke="currentColor"
//       className="h-6 w-6"
//     >
//       <path
//         strokeLinecap="round"
//         strokeLinejoin="round"
//         d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
//       />
//     </svg>
//   );
// };

/** Button component */

type ButtonProps<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button"
> = {
  as?: T;
  icon?: React.ReactNode;
  loading?: boolean;
  kind?: "primary" | "secondary";
} & (T extends keyof JSX.IntrinsicElements
  ? JSX.IntrinsicElements[T]
  : ComponentProps<T>);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      icon,
      kind = "primary",
      as: Component = "button",
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
          "my-2 flex items-center justify-center border-2 border-black px-3 py-1.5 text-sm font-bold leading-6 text-gray-900",
          "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-[transform,box-shadow]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          "focus-visible:translate-x-[2px] focus-visible:translate-y-[2px] focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          "active:translate-x-[3px] active:translate-y-[3px] active:bg-black active:text-white active:shadow-none",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
          "disabled:bg-gray-100 disabled:text-black disabled:hover:bg-gray-100",
          {
            "bg-amber-400 hover:bg-amber-500 focus-visible:bg-amber-500":
              kind === "primary",
            "bg-white hover:bg-gray-100 focus-visible:bg-gray-100":
              kind === "secondary",
          },
          props.className
        )}
      >
        <div className="flex items-center gap-1">
          {icon && <div>{icon}</div>}
          {children}
          {loading && <div className="animate-pulse">...</div>}
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
          "relative mx-auto my-10 w-full max-w-sm bg-white px-10 sm:border sm:px-4 sm:py-10 sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
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
        "block w-full border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] placeholder:font-bold focus:border-2 focus:border-black",
        "transition-[transform,box-shadow] focus-visible:translate-x-[4px] focus-visible:translate-y-[4px] focus-visible:shadow-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
        props.className
      )}
    />
  );
};
