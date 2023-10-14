import { useState } from "react";

type State = {
  state: "idle" | "submitting";
  error?:
    | "authorization_invalid"
    | "authorization_missing"
    | "new_device_failed"
    | "error_unknown";
};

export const useNewDevice = () => {
  const [state, setState] = useState<State>({
    state: "idle",
    error: undefined,
  });

  const submit = async (input: { username: string } | FormData) => {
    const formData = input instanceof FormData ? input : fromRecord(input);

    try {
      setState({ state: "idle" });
      const response = await fetch("/auth/api?act=new-device", {
        method: "POST",
        body: formData,
      });
      const redirect = response.headers.get("Location");

      if (redirect) {
        window.location.href = redirect;
      } else {
        setState({
          state: "idle",
          error: response.ok ? undefined : "new_device_failed",
        });
      }
    } catch (err) {
      console.error(err);
      setState({ state: "idle", error: "error_unknown" });
    }
  };

  return {
    submit,
    action: "/auth/api?act=new-device",
    form: { username: { name: "username" } },
    ...state,
  };
};

const fromRecord = (record: { username: string }) => {
  const formData = new FormData();
  formData.set("username", record.username);
  return formData;
};
