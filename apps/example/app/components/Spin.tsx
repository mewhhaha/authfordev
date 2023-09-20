import { cn } from "~/css/cn";

export const Spin = (props: JSX.IntrinsicElements["div"]) => (
  <div
    {...props}
    className={cn(
      "h-6 w-6 animate-spin rounded-full border-4 border-gray-600/50 border-t-indigo-600/80 invert",
      props.className
    )}
  />
);
