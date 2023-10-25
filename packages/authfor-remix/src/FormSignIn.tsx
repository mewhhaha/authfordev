import type { FormProps } from "@remix-run/react";
import { Form } from "@remix-run/react";
import type { Ref } from "react";
import { forwardRef, useEffect, useRef } from "react";
import { useSignIn } from "./useSignIn.js";

type FormSignInProps = {
  immediately?: true;
  clientKey: string;
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
} & Omit<FormProps, "children" | "className" | "onSubmit">;

const noop = () => {};

export const FormSignIn = forwardRef<HTMLFormElement, FormSignInProps>(
  ({ clientKey, immediately, children, className, ...props }, ref) => {
    const signin = useSignIn(clientKey);
    const childrenProps = { state: signin.state, error: signin.error };
    const internalRef = useRef<HTMLFormElement>(null);

    const onceRef = useRef(false);

    useEffect(() => {
      if (!immediately || internalRef.current === null || onceRef.current)
        return;
      onceRef.current = true;
      signin.submit({
        currentTarget: internalRef.current,
        preventDefault: noop,
      });
    }, [immediately, signin]);

    const jointRef = joinRefs(ref, internalRef);

    return (
      <Form
        ref={jointRef}
        onSubmit={signin.submit}
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

FormSignIn.displayName = "FormSignIn";

const joinRefs =
  <T extends HTMLElement>(...refs: Ref<T>[]) =>
  (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    }
  };
