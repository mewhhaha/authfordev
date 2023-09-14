import { cn } from "~/css/cn";

export const ButtonSecondary = (props: JSX.IntrinsicElements["button"]) => {
  return (
    <button
      {...props}
      className={cn(
        "rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
        props.className
      )}
    />
  );
};
