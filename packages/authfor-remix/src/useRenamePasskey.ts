import { useFetcher } from "@remix-run/react";
import type { FormEvent } from "react";
import { Intent, formOptions } from "./api.js";

export const useRenamePasskey = () => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = async (
    event: Pick<FormEvent<HTMLFormElement>, "preventDefault" | "currentTarget">
  ) => {
    if (fetcher.state !== "idle") {
      console.warn("Tried renaming passkey while already renaming passkey.");
      return;
    }

    const options = formOptions(event.currentTarget);
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    formData.set("intent", Intent.RenamePasskey);
    fetcher.submit(formData, options);
  };

  return {
    submit,
    state: fetcher.state,
    error: fetcher.data !== undefined,
  };
};
