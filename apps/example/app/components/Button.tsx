import { cn } from "~/css/cn";
import type { ComponentProps, JSXElementConstructor } from "react";
import { forwardRef } from "react";

type ButtonProps<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button"
> = {
  as?: T;
  icon?: React.ReactNode;
  loading?: boolean;
} & (
  | { primary: boolean; secondary?: boolean }
  | { primary?: boolean; secondary: boolean }
) &
  (T extends keyof JSX.IntrinsicElements
    ? JSX.IntrinsicElements[T]
    : ComponentProps<T>);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      icon,
      primary,
      as: Component = "button",
      secondary,
      loading,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Component
        ref={ref}
        {...props}
        aria-disabled={loading}
        onClick={loading ? undefined : props.onClick}
        className={cn(
          {
            "bg-amber-400 hover:bg-amber-500 focus-visible:bg-amber-500":
              primary,
            "bg-white hover:bg-gray-100 focus-visible:bg-gray-100": secondary,
          },
          "my-2 flex items-center justify-center rounded-lg border-2 border-black px-3 py-1.5 text-sm font-bold leading-6 text-gray-900",
          "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-[transform,box-shadow]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          "focus-visible:translate-x-[2px] focus-visible:translate-y-[2px] focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          "active:translate-x-[3px] active:translate-y-[3px] active:bg-black active:text-white active:shadow-none",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
          "disabled:bg-gray-100 disabled:text-black disabled:hover:bg-gray-100",
          props.className
        )}
      >
        <div className="flex items-center">
          {!loading && icon}
          {loading && <Spin className="mr-2 h-4 w-4 border-4" />}
          {children}
        </div>
      </Component>
    );
  }
) as (<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button"
>(
  props: ButtonProps<T>
) => JSX.Element) & { displayName?: string };

Button.displayName = "Button";

const Spin = (props: JSX.IntrinsicElements["div"]) => (
  <div
    {...props}
    className={cn(
      "h-6 w-6 animate-spin rounded-full border-4 border-gray-600/50 border-t-amber-600/80 invert",
      props.className
    )}
  />
);
