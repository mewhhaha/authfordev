import { type FormEvent } from "react";
import { useFetcher } from "@remix-run/react";
import { Intent, formOptions } from "./api.js";
import { useClient } from "./useClient.js";

export const useSignIn = (clientKey: string) => {
  const client = useClient(clientKey);

  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = async (
    event: Pick<FormEvent<HTMLFormElement>, "preventDefault" | "currentTarget">
  ) => {
    if (fetcher.state !== "idle") {
      console.warn("Tried signing in while already signing in.");
      return;
    }
    const options = formOptions(event.currentTarget);
    event.preventDefault?.();

    const { token, reason } = await client.signin();
    if (reason) {
      console.error(reason);
      return;
    }

    const formData = new FormData();
    formData.set("token", token);
    formData.set("intent", Intent.SignIn);
    fetcher.submit(formData, options);
  };

  return { submit, state: fetcher.state, error: fetcher.data !== undefined };
};
