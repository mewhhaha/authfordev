import type { FormProps } from "@remix-run/react";
import { Form } from "@remix-run/react";
import { forwardRef } from "react";
import { useAddPasskey } from "./useAddPasskey.js";

type UsernameProps = { name?: "username" } & (
  | { defaultValue: string; value?: string }
  | { value: string; defaultValue?: string }
) &
  Omit<JSX.IntrinsicElements["input"], "name">;

const Username = forwardRef<HTMLInputElement, UsernameProps>(
  ({ onChange, ...props }) => {
    return <input type="hidden" required name="username" {...props} />;
  }
);

Username.displayName = "Username";

type FormAddPasskeyProps = {
  clientKey: string;
  method?: "POST";
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

const FormForward = forwardRef<HTMLFormElement, FormAddPasskeyProps>(
  ({ clientKey, children, className, ...props }, ref) => {
    const addPasskey = useAddPasskey(clientKey);
    const childrenProps = { state: addPasskey.state, error: addPasskey.error };
    return (
      <Form
        ref={ref}
        onSubmit={addPasskey.submit}
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

FormForward.displayName = "FormSignUp";

export const FormAddPasskey = FormForward as typeof FormForward & {
  Username: typeof Username;
};

FormAddPasskey.Username = Username;
