import type { AuthforDevClient } from "@mewhhaha/authfordev-client";
import { Client } from "@mewhhaha/authfordev-client";
import type { FormEvent } from "react";
import { useState } from "react";
import type { SubmitOptions } from "@remix-run/react";
import { useFetcher } from "@remix-run/react";
import { Intent } from "./intent";

export const useAuth = (clientKey: string) => {
  const [client] = useState(() => Client({ clientKey }));
  const signin = useSignIn(client);
  const signup = useSignUp(client);
  const signout = useSignOut();
  const aliases = useAliases();
  const addPasskey = useAddPasskey(client);

  return { signin, signout, signup, aliases, addPasskey };
};

export const useAliases = () => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

export const useSignOut = () => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const options = formOptions(event.currentTarget);
    const formData = new FormData(event.currentTarget);
    formData.set("intent", Intent.SignOut);
    fetcher.submit(formData, options);
  };

  return { submit, state: fetcher.state };
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
    formData.set("intent", Intent.SignIn);
    fetcher.submit(formData, options);
  };

  return { submit, state: fetcher.state, error: fetcher.data !== undefined };
};

export const useSignUp = (client: AuthforDevClient) => {
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    if (fetcher.state !== "idle") {
      console.warn("Tried signing in while already signing in.");
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

    formData.set("intent", Intent.SignUp);
    formData.set("token", token);
    fetcher.submit(formData, options);
  };

  return {
    submit,
    state: fetcher.state,
    error: fetcher.data !== undefined,
    form: { username: { name: "username" } },
  };
};

export const useAddPasskey = (client: AuthforDevClient) => {
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
