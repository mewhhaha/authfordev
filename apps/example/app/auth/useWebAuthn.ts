import type { AuthforDevClient } from "@mewhhaha/authfordev-client";
import { Client } from "@mewhhaha/authfordev-client";
import type { FormEvent } from "react";
import { useState } from "react";
import type { SubmitOptions } from "@remix-run/react";
import { useFetcher } from "@remix-run/react";

export const useWebAuthn = (clientKey: string) => {
  const [client] = useState(() => Client({ clientKey }));
  const signin = useSignIn(client);
  const register = useRegisterDevice();
  const create = useCreateUser();
  const verify = useVerifyDevice(client);
  const signout = useSignOut();

  return { signin, signout, register, create, verify };
};

export const useSignOut = () => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const options = formOptions(event.currentTarget);
    const formData = new FormData(event.currentTarget);
    formData.set("intent", "sign-out");
    fetcher.submit(formData, options);
  };

  return { submit, state: fetcher.state, intent: "sign-out" };
};

export const useSignIn = (client: AuthforDevClient) => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    if (fetcher.state !== "idle") {
      console.warn("Tried signing in while already signing in.");
      return;
    }
    const options = formOptions(event.currentTarget);
    event.preventDefault();
    const { token, reason } = await client.signin();
    if (reason) {
      console.error(reason);
      return;
    }

    const formData = new FormData();
    formData.set("token", token);
    formData.set("intent", "sign-in");
    fetcher.submit(formData, options);
  };

  return { submit, state: fetcher.state, error: fetcher.data !== undefined };
};

export const useCreateUser = () => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const options = formOptions(event.currentTarget);
    const formData = new FormData(event.currentTarget);
    formData.set("intent", "new-user");
    fetcher.submit(formData, options);
  };

  return {
    submit,
    state: fetcher.state,
    error: fetcher.data !== undefined,
    form: { username: { name: "username" }, email: { name: "email" } },
  };
};

export const useRegisterDevice = () => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const options = formOptions(event.currentTarget);
    console.log(options);

    const formData = new FormData(event.currentTarget);
    formData.set("intent", "new-device");
    fetcher.submit(formData, options);
  };

  return {
    submit,
    state: fetcher.state,
    error: fetcher.data !== undefined,
    form: { username: { name: "username" } },
  };
};

export const useVerifyDevice = (client: AuthforDevClient) => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    if (fetcher.state !== "idle") {
      console.warn("Tried verifying in while already verifying.");
      return;
    }

    const options = formOptions(event.currentTarget);
    const formData = new FormData(event.currentTarget);

    const challenge = formData.get("challenge")?.toString();
    const code = formData.get("code")?.toString();
    const username = formData.get("username")?.toString();

    if (!challenge || !code || !username) {
      console.error(
        "Missing the following form data:",
        challenge && "challenge",
        code && "code",
        username && "username"
      );
      return;
    }

    const { token, reason } = await client.register(challenge, code, username);
    if (reason) {
      console.error(reason);
      return;
    }

    formData.set("token", token);
    formData.set("intent", "verify-device");
    fetcher.submit(formData, options);
  };

  return {
    submit,
    state: fetcher.state,
    error: fetcher.data !== undefined,
    form: { username: { name: "username" }, email: { name: "email" } },
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
