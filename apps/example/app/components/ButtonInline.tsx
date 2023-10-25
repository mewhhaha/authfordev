import type { JSXElementConstructor, ComponentProps } from "react";
import { forwardRef } from "react";
import { cn } from "~/css/cn.js";

export type ButtonInlineProps<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button",
> = {
  as?: T;
  icon?: React.ReactNode;
  loading?: boolean;
} & (T extends keyof JSX.IntrinsicElements
  ? JSX.IntrinsicElements[T]
  : ComponentProps<T>);

export const ButtonInline = forwardRef<HTMLButtonElement, ButtonInlineProps>(
  (
    { icon, loading = false, as: Component = "button", children, ...props },
    ref
  ) => {
    return (
      <Component
        ref={ref}
        {...props}
        aria-disabled={loading}
        onClick={loading ? undefined : props.onClick}
        className={cn(
          "px-3 py-2 text-sm font-bold leading-6 text-gray-900",
          "focus:outline focus:outline-2 focus:outline-offset-2",
          "active:bg-black active:text-white",
          "disabled:bg-gray-100 disabled:text-black disabled:hover:bg-gray-100",
          "bg-white hover:bg-gray-100 focus:bg-gray-100",
          "inline-block translate-x-0 translate-y-0 border-y-0 border-l-8 border-r-0 border-black shadow-none transition-[border] ease-linear hover:border-x-4 hover:shadow-none focus:border-x-4 active:border-l-0 active:border-r-8",
          props.className
        )}
      >
        <div className="flex items-center">
          {icon && <div className="mr-2">{icon}</div>}
          {children}
          {loading && <div className="ml-2 animate-pulse">...</div>}
        </div>
      </Component>
    );
  }
) as (<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button",
>(
  props: ButtonInlineProps<T>
) => JSX.Element) & { displayName?: string };

ButtonInline.displayName = "ButtonInline";
