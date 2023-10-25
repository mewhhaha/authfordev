import { forwardRef } from "react";
import { cn } from "~/css/cn.js";

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
        "relative mx-auto my-10 w-full max-w-sm bg-white px-10 sm:border sm:px-4 sm:py-10 sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        props.className
      )}
    />
  );
});

Dialog.displayName = "Dialog";
