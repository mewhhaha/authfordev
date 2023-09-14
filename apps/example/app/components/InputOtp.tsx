import type { FormEvent, FocusEvent, KeyboardEvent } from "react";
import { cn } from "~/css/cn";

export const InputOtp = (props: JSX.IntrinsicElements["input"]) => {
  const handleInput = (event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const value = input.value.replace(/[^0-9]/g, "");

    input.value = value[0] || "";

    let current: HTMLInputElement | null =
      input.nextElementSibling as HTMLInputElement;

    for (const v of value.slice(1)) {
      if (!current) break;
      current.value = v;
      current = current.nextElementSibling as HTMLInputElement;
    }

    (current || input).focus();
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.setSelectionRange(0, 1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const current = event.currentTarget;
    const previous = event.currentTarget
      .previousElementSibling as HTMLInputElement | null;
    if (
      event.key === "Backspace" &&
      current.selectionStart === 0 &&
      current.selectionEnd === 0 &&
      previous
    ) {
      previous.value = "";
      previous.focus();
    }
  };
  return (
    <input
      type="text"
      name="code"
      onInput={handleInput}
      placeholder="_"
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      required
      pattern="^[0-9]$"
      inputMode="numeric"
      {...props}
      className={cn(
        "block w-12 rounded-md border-0 py-1.5 text-center text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xl sm:leading-6",
        props.className
      )}
    />
  );
};
