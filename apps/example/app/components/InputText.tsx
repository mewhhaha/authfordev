import type { Ref, ComponentProps } from "react";
import { forwardRef } from "react";
import { cn } from "~/css/cn.js";

type InputTextProps<
  T extends
    | "input"
    | ((props: {
        name: string;
        ref: Ref<HTMLInputElement>;
      }) => React.ReactNode) = "input",
> = {
  as?: T;
} & (T extends "input" ? JSX.IntrinsicElements["input"] : ComponentProps<T>);

export const InputText = forwardRef<HTMLInputElement, InputTextProps>(
  ({ as: Component = "input", className, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(
          "block w-full border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] placeholder:font-bold focus:border-2 focus:border-black",
          "transition-[transform,box-shadow] focus-visible:translate-x-[4px] focus-visible:translate-y-[4px] focus-visible:shadow-none",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
          className
        )}
        {...props}
      />
    );
  }
) as (<
  T extends
    | "input"
    | ((props: {
        name?: any extends string ? any : never;
      }) => React.ReactNode) = "input",
>(
  props: InputTextProps<T>
) => React.ReactNode) & { displayName?: string };

InputText.displayName = "InputText";
