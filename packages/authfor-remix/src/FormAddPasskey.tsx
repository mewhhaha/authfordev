import type { FormProps } from "@remix-run/react";
import { Form } from "@remix-run/react";
import { forwardRef } from "react";
import { useAddPasskey } from "./useAddPasskey.js";

type FormAddPasskeyProps = {
  clientKey: string;
  username: string;
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

export const FormAddPasskey = forwardRef<HTMLFormElement, FormAddPasskeyProps>(
  ({ clientKey, username, children, className, ...props }, ref) => {
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
        <input type="hidden" required name="username" value={username} />
        {typeof children === "function" ? children(childrenProps) : children}
      </Form>
    );
  }
);

FormAddPasskey.displayName = "FormAddPasskey";
