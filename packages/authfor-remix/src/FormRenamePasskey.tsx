import type { FormProps } from "@remix-run/react";
import { Form } from "@remix-run/react";
import { forwardRef } from "react";
import { useRenamePasskey } from "./useRenamePasskey.js";

type InputNameProps = {
  name?: "passkeyName";
} & Omit<JSX.IntrinsicElements["input"], "name">;

const InputName = forwardRef<HTMLInputElement, InputNameProps>((props) => {
  return (
    <input
      type="text"
      minLength={1}
      maxLength={60}
      required
      name="passkeyName"
      {...props}
    />
  );
});

InputName.displayName = "InputName";

type FormRenamePasskeyProps = {
  method?: "POST";
  passkeyId: string;
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

const _FormRenamePasskey = forwardRef<HTMLFormElement, FormRenamePasskeyProps>(
  ({ passkeyId, children, className, ...props }, ref) => {
    const renamePasskey = useRenamePasskey();
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
  }
);

_FormRenamePasskey.displayName = "FormRenamePasskey";

export const FormRenamePasskey =
  _FormRenamePasskey as typeof _FormRenamePasskey & {
    InputName: typeof InputName;
  };

FormRenamePasskey.InputName = InputName;
