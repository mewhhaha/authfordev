import { type FormEvent, useRef } from "react";
import { useFetcher } from "@remix-run/react";
import { useClient } from "./useClient.js";
import { Intent, formOptions } from "./api.js";

export const useSignUp = (clientKey: string, taken?: string) => {
  const client = useClient(clientKey);
  const fetcher = useFetcher<{ message: string; status: number }>();
  const controller = useRef<AbortController>();

  const submit = async (
    event: Pick<FormEvent<HTMLFormElement>, "preventDefault" | "currentTarget">
  ) => {
    if (fetcher.state !== "idle") {
      console.warn("Tried signing in while already signing in.");
      return;
    }

    const element = event.currentTarget;

    const options = formOptions(element);
    event.preventDefault?.();

    const formData = new FormData(element);

    const username = formData.get("username")?.toString();
    if (!username) {
      console.error(
        "The username input field is missing. Did you forget to add <FormSignup.Username />?"
      );
      return;
    }

    if (controller.current) {
      controller.current.abort();
    }
    controller.current = new AbortController();

    const checkAliases = new FormData();
    checkAliases.set("intent", Intent.CheckAliases);
    checkAliases.set("username", username);

    const response = await fetch(
      `${options.action}?_data=${encodeURIComponent(
        `routes${options.action}`
      )}`,
      {
        method: "POST",
        body: checkAliases,
        signal: controller.current.signal,
      }
    );
    const { status }: { status: number } = await response.json();
    if (status !== 200) {
      const input = element.querySelector<HTMLInputElement>(
        'input[name="username"]'
      );
      if (!input) {
        console.error(
          "The username element wasn't found. This is very odd since we managed to pull the form data from it before. Are you doing something tricky?"
        );
      } else {
        input.setCustomValidity(taken || "Username taken");
        input.reportValidity();
      }
      return;
    }

    const { token, reason } = await client.register(username);
    if (reason) {
      console.error(reason);
      return;
    }

    formData.set("intent", Intent.SignUp);
    formData.set("token", token);
    fetcher.submit(formData, options);
  };

  return {
    submit,
    state: fetcher.state,
    error: fetcher.data !== undefined,
  };
};
