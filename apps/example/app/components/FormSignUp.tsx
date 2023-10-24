import { useSignUp } from "~/auth/useWebauthn";
import type { FormProps } from "@remix-run/react";
import { Form } from "@remix-run/react";
import { forwardRef } from "react";

type UsernameProps = { name?: "username" } & Omit<
  JSX.IntrinsicElements["input"],
  "name"
>;

export const Username = forwardRef<HTMLInputElement, UsernameProps>(
  (props: JSX.IntrinsicElements["input"]) => {
    return (
      <input
        type="text"
        autoComplete="username"
        required
        name="name"
        {...props}
      />
    );
  }
);

Username.displayName = "Username";

type FormSignUpProps = {
  clientKey: string;
  method?: "POST";
  children:
    | React.ReactNode
    | ((props: {
        state: "idle" | "submitting" | "loading";
        error: boolean;
      }) => React.ReactNode);
} & Omit<FormProps, "children" | "method" | "onSubmit">;

const FormForward = forwardRef<HTMLFormElement, FormSignUpProps>(
  ({ clientKey, children, ...props }, ref) => {
    const signup = useSignUp(clientKey);
    return (
      <Form ref={ref} onSubmit={signup.submit} method="POST" {...props}>
        {typeof children === "function"
          ? children({ state: signup.state, error: signup.error })
          : children}
      </Form>
    );
  }
);

FormForward.displayName = "FormSignUp";

export const FormSignUp = FormForward as typeof FormForward & {
  Username: typeof Username;
};

FormSignUp.Username = Username;
