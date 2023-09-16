import { cn } from "~/css/cn";
import { Spin } from "./Spin";

type ButtonProps = {
  loading?: boolean;
} & (
  | { primary: boolean; secondary?: boolean }
  | { primary?: boolean; secondary: boolean }
) &
  JSX.IntrinsicElements["button"];

export const Button = ({
  primary,
  secondary,
  loading,
  children,
  ...props
}: ButtonProps) => {
  return (
    <button
      {...props}
      onClick={loading ? undefined : props.onClick}
      className={cn(
        "flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-semibold leading-6 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        {
          "bg-indigo-600 text-white hover:bg-indigo-500  focus-visible:outline-indigo-600":
            primary,
          "bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-indigo-600":
            secondary,
        },
        props.className
      )}
    >
      <div className="flex items-center">
        {loading && <Spin className="mr-2 h-4 w-4 border-4" />}
        {children}
      </div>
    </button>
  );
};
