import { useFetcher } from "@remix-run/react";
import type { FormEvent } from "react";
import { Intent, formOptions } from "./api.js";

export const useRemovePasskey = () => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = async (
    event: Pick<FormEvent<HTMLFormElement>, "preventDefault" | "currentTarget">
  ) => {
    if (fetcher.state !== "idle") {
      console.warn("Tried removing passkey while already removing passkey.");
      return;
    }

    const options = formOptions(event.currentTarget);
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    formData.set("intent", Intent.RemovePasskey);
    fetcher.submit(formData, options);
  };

  return {
    submit,
    state: fetcher.state,
    error: fetcher.data !== undefined,
  };
};
