import type { FormProps } from "@remix-run/react";
import { Form } from "@remix-run/react";
import { forwardRef } from "react";
import { useSignUp } from "./useSignUp.js";

type InputUsernameProps = { name?: "username" } & Omit<
  JSX.IntrinsicElements["input"],
  "name"
>;

const InputUsername = forwardRef<HTMLInputElement, InputUsernameProps>(
  ({ onChange, ...props }: JSX.IntrinsicElements["input"]) => {
    return (
      <input
        type="text"
        autoComplete="username"
        required
        onChange={(event) => {
          onChange?.(event);
          event.target.setCustomValidity("");
        }}
        name="username"
        {...props}
      />
    );
  }
);

InputUsername.displayName = "InputUsername";

type FormSignUpProps = {
  clientKey: string;
  method?: "POST";
  taken?: string;
  className?:
    | string
    | ((props: {
        state: "idle" | "submitting" | "loading";
        error: boolean;
      }) => string);
  children:
    | React.ReactNode
    | ((props: {
        state: "idle" | "submitting" | "loading";
        error: boolean;
      }) => React.ReactNode);
} & Omit<FormProps, "children" | "method" | "onSubmit" | "className">;

const _FormSignUp = forwardRef<HTMLFormElement, FormSignUpProps>(
  ({ clientKey, taken = "", children, className, ...props }, ref) => {
    const signup = useSignUp(clientKey, taken);
    const childrenProps = { state: signup.state, error: signup.error };
    return (
      <Form
        ref={ref}
        onSubmit={signup.submit}
        method="POST"
        className={
          typeof className === "function" ? className(childrenProps) : className
        }
        {...props}
      >
        {typeof children === "function" ? children(childrenProps) : children}
      </Form>
    );
  }
);

_FormSignUp.displayName = "FormSignUp";

export const FormSignUp = _FormSignUp as typeof _FormSignUp & {
  InputUsername: typeof InputUsername;
};

FormSignUp.InputUsername = InputUsername;
