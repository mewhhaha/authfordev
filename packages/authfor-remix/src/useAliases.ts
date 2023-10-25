import { type FormEvent } from "react";
import { useFetcher } from "@remix-run/react";
import { formOptions, Intent } from "./api.js";

export const useAliases = () => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = (
    event: Pick<FormEvent<HTMLFormElement>, "preventDefault" | "currentTarget">
  ) => {
    event.preventDefault?.();
    const options = formOptions(event.currentTarget);
    const formData = new FormData(event.currentTarget);
    formData.set("intent", Intent.CheckAliases);
    fetcher.submit(formData, options);
  };

  return {
    submit,
    state: fetcher.state,
    error: fetcher.data !== undefined && fetcher.data.status !== 200,
  };
};
