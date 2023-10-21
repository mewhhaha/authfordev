import { Client } from "@mewhhaha/authfordev-client";
import type { SubmitOptions } from "@remix-run/react";
import { useFetcher } from "@remix-run/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Intent } from "./intent";

export const useAddPasskey = (clientKey: string) => {
  const [client] = useState(() => Client({ clientKey }));
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
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

const formOptions = (element: HTMLFormElement) =>
  ({
    method: element.method,
    encType: element.enctype,
    action: element.action.startsWith("http")
      ? new URL(element.action).pathname
      : element.action,
  } as SubmitOptions);
