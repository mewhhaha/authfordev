import { type FormEvent } from "react";
import { useFetcher } from "@remix-run/react";
import { Intent, formOptions } from "./api.js";

export const useSignOut = () => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = (
    event: Pick<FormEvent<HTMLFormElement>, "preventDefault" | "currentTarget">
  ) => {
    event.preventDefault?.();
    const options = formOptions(event.currentTarget);
    const formData = new FormData(event.currentTarget);
    formData.set("intent", Intent.SignOut);
    fetcher.submit(formData, options);
  };

  return { submit, state: fetcher.state, error: fetcher.data !== undefined };
};
