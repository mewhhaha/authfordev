import type { FormProps } from "@remix-run/react";
import { Form } from "@remix-run/react";
import { forwardRef } from "react";
import { useSignOut } from "./useSignOut.js";

type FormSignOutProps = {
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
} & Omit<FormProps, "children" | "onSubmit" | "className">;

export const FormSignOut = forwardRef<HTMLFormElement, FormSignOutProps>(
  ({ children, className, ...props }, ref) => {
    const signout = useSignOut();
    const childrenProps = { state: signout.state, error: signout.error };
    return (
      <Form
        ref={ref}
        onSubmit={signout.submit}
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

FormSignOut.displayName = "FormSignOut";
