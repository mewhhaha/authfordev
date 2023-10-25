import { useFetcher } from "@remix-run/react";
import { useClient } from "./useClient.js";
import type { FormEvent } from "react";
import { Intent, formOptions } from "./api.js";

export const useAddPasskey = (clientKey: string) => {
  const client = useClient(clientKey);
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = async (
    event: Pick<FormEvent<HTMLFormElement>, "preventDefault" | "currentTarget">
  ) => {
    if (fetcher.state !== "idle") {
      console.warn("Tried adding passkey while already adding passkey.");
      return;
    }

    const options = formOptions(event.currentTarget);
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const username = formData.get("username")?.toString();
    if (!username) {
      console.error("username_missing");
      return;
    }

    const { token, reason } = await client.register(username);
    if (reason) {
      console.error(reason);
      return;
    }

    formData.set("intent", Intent.AddPasskey);
    formData.set("token", token);
    fetcher.submit(formData, options);
  };

  return {
    submit,
    state: fetcher.state,
    error: fetcher.data !== undefined,
  };
};
