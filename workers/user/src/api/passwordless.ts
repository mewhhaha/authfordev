import type { FetchDefinition, Queries } from "@mewhhaha/little-router";
import type { JSONString } from "@mewhhaha/json-string";
import { fetcher } from "@mewhhaha/little-fetcher";
import type { BodyResponse, JSONResponse } from "@mewhhaha/typed-response";

export type BodyRegisterToken = {
  userId: string;
  username: string;
  displayname?: string;
  aliases?: string[];
};

type RoutesRegisterToken = FetchDefinition<
  "post",
  "/register/token",
  Queries,
  {
    body: JSONString<BodyRegisterToken>;
    headers: {
      "Content-Type": "application/json";
      ApiSecret: string;
    };
  },
  JSONResponse<200, { token: string }> | BodyResponse<403>
>;

export type BodySigninVerify = {
  token: string;
};

type RoutesSigninVerify = FetchDefinition<
  "post",
  "/signin/verify",
  Queries,
  {
    body: JSONString<BodySigninVerify>;
    headers: {
      "Content-Type": "application/json";
      ApiSecret: string;
    };
  },
  JSONResponse<
    200,
    {
      success: boolean;
      userId: string;
      timestamp: string;
      rpid: string;
      origin: string;
      device: string;
      country: string;
      nickname: string;
      expiresAt: string;
      CredentialId: string;
      type: "passkey_signin" | "passkey_register";
    }
  >
>;

export const passwordless = (base: string) =>
  fetcher<RoutesRegisterToken | RoutesSigninVerify>("fetch", { base: base });

export type Passwordless = ReturnType<typeof passwordless>;
