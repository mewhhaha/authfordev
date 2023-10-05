import { cn } from "~/css/cn";
import { forwardRef } from "react";
import { Link, type LinkProps } from "@remix-run/react";

type ButtonLinkProps = {
  loading?: boolean;
} & (
  | { primary: boolean; secondary?: boolean }
  | { primary?: boolean; secondary: boolean }
) &
  LinkProps;

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ primary, secondary, loading, children, ...props }, ref) => {
    return (
      <Link
        {...props}
        ref={ref}
        onClick={loading ? undefined : props.onClick}
        className={cn(
          {
            "bg-indigo-600 text-white hover:bg-indigo-500": primary,
            "bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50":
              secondary,
          },
          "flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-semibold leading-6 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-gray-100 disabled:text-black disabled:hover:bg-gray-100",

          props.className
        )}
      >
        <div className="flex items-center">
          {loading && <Spin className="mr-2 h-4 w-4 border-4" />}
          {children}
        </div>
      </Link>
    );
  }
);

ButtonLink.displayName = "ButtonLink";

const Spin = (props: JSX.IntrinsicElements["div"]) => (
  <div
    {...props}
    className={cn(
      "h-6 w-6 animate-spin rounded-full border-4 border-gray-600/50 border-t-indigo-600/80 invert",
      props.className
    )}
  />
);
