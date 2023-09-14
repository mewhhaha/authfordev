import { cn } from "~/css/cn";

export const InputText = (props: JSX.IntrinsicElements["input"]) => {
  return (
    <input
      {...props}
      className={cn(
        "block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6",
        props.className
      )}
    />
  );
};
