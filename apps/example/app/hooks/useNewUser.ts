import { useState } from "react";

type State = {
  state: "idle" | "submitting";
  error?:
    | "authorization_invalid"
    | "authorization_missing"
    | "new_user_failed"
    | "error_unknown";
};

export const useNewUser = () => {
  const [state, setState] = useState<State>({
    state: "idle",
    error: undefined,
  });

  const submit = async (
    input:
      | {
          username: string;
          email: string;
        }
      | FormData
  ) => {
    const formData = input instanceof FormData ? input : fromRecord(input);

    try {
      setState({ state: "submitting" });
      const response = await fetch("/auth/api?act=new-user", {
        method: "POST",
        body: formData,
      });
      const redirect = response.headers.get("Location");

      if (redirect) {
        window.location.href = redirect;
      } else {
        setState({
          state: "idle",
          error: response.ok ? undefined : "new_user_failed",
        });
      }
    } catch (err) {
      console.error(err);
      setState({ state: "idle", error: "error_unknown" });
    }
  };

  return {
    submit,
    action: "/auth/api?act=new-user",
    form: { username: { name: "username" }, email: { name: "email" } },
    ...state,
  };
};

const fromRecord = (record: { username: string; email: string }) => {
  const formData = new FormData();
  formData.set("username", record.username);
  formData.set("email", record.email);
  return formData;
};
