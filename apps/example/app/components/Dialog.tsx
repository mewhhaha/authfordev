import { forwardRef } from "react";
import { cn } from "~/css/cn";

export const Dialog = forwardRef<
  HTMLDialogElement,
  JSX.IntrinsicElements["dialog"]
>((props, ref) => {
  return (
    <dialog
      ref={ref}
      open
      {...props}
      className={cn(
        "relative m-auto w-full max-w-sm rounded-md border-black bg-white p-10 ring-amber-200 sm:border-4 sm:ring-4",
        props.className
      )}
    />
  );
});

Dialog.displayName = "Dialog";
