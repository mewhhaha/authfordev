import { Client } from "@mewhhaha/authfordev-client";
import { useState } from "react";

type State = {
  state: "idle" | "submitting";
  error?:
    | "authorization_invalid"
    | "authorization_missing"
    | "register_device_failed"
    | "register_aborted"
    | "error_unknown";
};

export const useRegisterDevice = (
  clientKey: string,
  { navigate }: { navigate?: (url: string) => void } = {}
) => {
  const [state, setState] = useState<State>({
    state: "idle",
    error: undefined,
  });

  const submit = async (
    input:
      | {
          challenge: string;
          username: string;
          code: string;
        }
      | FormData
  ) => {
    const record = input instanceof FormData ? fromFormData(input) : input;

    if (state.state !== "idle") {
      console.warn("Tried registering device while already registering device");
    }
    try {
      setState({ state: "submitting" });
      const client = Client({ clientKey });

      const { token, reason } = await client.register(
        record.challenge,
        record.code,
        record.username
      );

      if (reason) {
        setState({ state: "idle", error: reason });
        return;
      }

      const formData = new FormData();
      formData.set("token", token);
      const response = await fetch("/auth/api?act=register-device", {
        method: "POST",
        body: formData,
      });
      const redirect = response.headers.get("Location");

      if (redirect) {
        if (navigate) navigate(redirect);
        else window.location.href = redirect;
      } else {
        setState({
          state: "idle",
          error: response.ok ? undefined : "register_device_failed",
        });
      }
    } catch (err) {
      console.error(err);
      setState({ state: "idle", error: "error_unknown" });
    }
  };

  return {
    submit,
    action: "/auth/api?act=register-device",
    form: { username: { name: "username" }, email: { name: "email" } },
    ...state,
  };
};

const fromFormData = (formData: FormData) => {
  const record = {
    challenge: formData.get("challenge") as string,
    username: formData.get("username") as string,
    code: formData.get("code") as string,
  };

  return record;
};
