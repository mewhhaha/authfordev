import type { JSXElementConstructor, ComponentProps } from "react";
import { forwardRef } from "react";
import { cn } from "~/css/cn.js";
import { IconArrowPath } from "./IconArrowPath.js";

export type ButtonProps<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button",
> = {
  as?: T;
  loading?: boolean;
  icon?: React.ReactNode;
  kind?: "primary" | "secondary" | "tertiary";
} & (T extends keyof JSX.IntrinsicElements
  ? JSX.IntrinsicElements[T]
  : ComponentProps<T>);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      icon,
      kind = "primary",
      loading = false,
      as: Component = "button",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Component
        ref={ref}
        {...props}
        onClick={props.onClick}
        className={cn(
          "my-2 flex items-center justify-center border-2 border-black px-3 py-1.5 text-sm font-bold leading-6 text-gray-900",
          "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
          "focus:outline focus:outline-2 focus:outline-offset-2",
          "active:bg-black active:text-white",
          "disabled:bg-gray-100 disabled:text-black disabled:hover:bg-gray-100",
          {
            "bg-amber-400 hover:bg-amber-500 focus:bg-amber-500":
              kind === "primary",
            "bg-white hover:bg-gray-100 focus:bg-gray-100":
              kind === "secondary",
            "bg-white hover:bg-gray-100 border-gray-100 focus:bg-gray-100":
              kind === "tertiary",
          },

          props.className
        )}
      >
        <div className="flex items-center">
          {icon && <div className="mr-2">{icon}</div>}
          {children}
          {loading && (
            <div className="ml-2 animate-pulse">
              <IconArrowPath className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>
      </Component>
    );
  }
) as (<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button",
>(
  props: ButtonProps<T>
) => JSX.Element) & { displayName?: string };

Button.displayName = "Button";
