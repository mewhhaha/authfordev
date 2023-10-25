import type { FormProps } from "@remix-run/react";
import { Form } from "@remix-run/react";
import { forwardRef } from "react";
import { useRemovePasskey } from "./useRemovePasskey.js";

type FormRemovePasskeyProps = {
  method?: "POST";
  passkeyId?: string;
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

export const FormRemovePasskey = forwardRef<
  HTMLFormElement,
  FormRemovePasskeyProps
>(({ passkeyId, children, className, ...props }, ref) => {
  const renamePasskey = useRemovePasskey();
  const childrenProps = {
    state: renamePasskey.state,
    error: renamePasskey.error,
  };
  return (
    <Form
      ref={ref}
      onSubmit={renamePasskey.submit}
      method="POST"
      className={
        typeof className === "function" ? className(childrenProps) : className
      }
      {...props}
    >
      <input type="hidden" required name="passkeyId" value={passkeyId} />
      {typeof children === "function" ? children(childrenProps) : children}
    </Form>
  );
});

FormRemovePasskey.displayName = "FormRemovePasskey";
