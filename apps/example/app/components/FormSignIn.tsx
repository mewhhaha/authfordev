import { useSignIn } from "~/auth/useWebauthn";
import type { FormProps } from "@remix-run/react";
import { Form } from "@remix-run/react";
import { forwardRef } from "react";

type FormSignInProps = {
  immediately?: boolean;
  clientKey: string;
  children:
    | React.ReactNode
    | ((props: {
        state: "idle" | "submitting" | "loading";
        error: boolean;
      }) => React.ReactNode);
} & Omit<FormProps, "children">;

export const FormSignIn = forwardRef<HTMLFormElement, FormSignInProps>(
  ({ clientKey, immediately, children, ...props }, ref) => {
    const signin = useSignIn(clientKey);
    return (
      <Form
        ref={ref}
        onLoad={immediately ? signin.submit : undefined}
        onSubmit={signin.submit}
        method="POST"
        {...props}
      >
        {typeof children === "function"
          ? children({ state: signin.state, error: signin.error })
          : children}
      </Form>
    );
  }
);

FormSignIn.displayName = "FormSignIn";
