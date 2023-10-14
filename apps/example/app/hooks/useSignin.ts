import { Client } from "@mewhhaha/authfordev-client";
import { useState } from "react";

type State = {
  state: "idle" | "submitting";
  error?:
    | "authorization_invalid"
    | "authorization_missing"
    | "signin_aborted"
    | "signin_failed"
    | "error_unknown";
};

export const useSignIn = (clientKey: string) => {
  const [state, setState] = useState<State>({
    state: "idle",
    error: undefined,
  });

  const submit = async () => {
    try {
      setState({ state: "idle" });
      const client = Client({ clientKey });
      const { token, reason } = await client.signin();
      if (reason) {
        console.error(reason);
        setState({ state: "idle", error: reason });
      } else {
        const formData = new FormData();
        formData.append("token", token);

        const response = await fetch("/auth/api?act=sign-in", {
          method: "POST",
          body: formData,
        });
        const redirect = response.headers.get("Location");

        if (redirect) {
          window.location.href = redirect;
        } else {
          setState({
            state: "idle",
            error: response.ok ? undefined : "signin_failed",
          });
        }
      }
    } catch (err) {
      console.error(err);
      setState({ state: "idle", error: "error_unknown" });
    }
  };

  return { submit, action: "/auth/api?act=sign-in", ...state };
};
