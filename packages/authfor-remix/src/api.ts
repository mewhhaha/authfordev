import type { FetcherOf } from "@mewhhaha/little-fetcher";
import { fetcher } from "@mewhhaha/little-fetcher";
import type { Routes } from "@mewhhaha/authfor-api";
import type { SubmitOptions } from "@remix-run/react";

export const api: FetcherOf<Routes> = fetcher<Routes>("fetch", {
  base: "https://user.authfor.dev",
});

export enum Intent {
  SignOut = "sign-out",
  SignIn = "sign-in",
  SignUp = "sign-up",
  CheckAliases = "check-aliases",
  AddPasskey = "add-passkey",
  RemovePasskey = "remove-passkey",
  RenamePasskey = "rename-passkey",
}

export const formOptions = (element: HTMLFormElement) =>
  ({
    method: element.method,
    encType: element.enctype,
    action: element.action.startsWith("http")
      ? new URL(element.action).pathname
      : element.action,
  }) as SubmitOptions;
