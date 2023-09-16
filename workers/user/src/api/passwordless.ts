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

type RouteRegisterToken = FetchDefinition<
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

type RouteSigninVerify = FetchDefinition<
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
      credentialId: string;
      tokenId: string;
      type: "passkey_signin" | "passkey_register";
    }
  >
>;

const x = {
  userId: "kopatheonlyone@hotmail.com",
  timestamp: "2023-09-16T11:57:35.5626536Z",
  rpid: "localhost",
  origin: "http://localhost:8788",
  success: true,
  device: "Chrome, Windows 10",
  country: "SE",
  nickname: "kopatheonlyone@hotmail.com",
  credentialId: "kGaTiG7blzSK63AEGRtItFvSiYYSbN2UO9Eph/LIOUc=",
  expiresAt: "2023-09-16T11:59:35.5626537Z",
  tokenId: "d76a6ecf-cc1d-4324-b89c-957de601c66f",
  type: "passkey_signin",
};

export type BodyCredentialsList = {
  userId: string;
};

export type Credential = {
  descriptor: {
    type: "public-key";
    id: string;
  };
  publicKey: string;
  userHandle: string;
  signatureCounter: number;
  createdAt: string;
  aaGuid: string;
  lastUsedAt: string;
  rpid: string;
  origin: string;
  country: string;
  device: string;
  nickname: string;
  userId: string;
};

type RouteCredentialsList = FetchDefinition<
  "post",
  "/credentials/list",
  Queries,
  {
    body: JSONString<BodyCredentialsList>;
    headers: {
      "Content-Type": "application/json";
      ApiSecret: string;
    };
  },
  JSONResponse<200, { values: Credential[] }>
>;

export type BodyCredentialsDelete = {
  credentialId: string;
};
type RouteCredentialsDelete = FetchDefinition<
  "post",
  "/credentials/delete",
  Queries,
  {
    body: JSONString<BodyCredentialsDelete>;
    headers: {
      "Content-Type": "application/json";
      ApiSecret: string;
    };
  },
  JSONResponse<200, unknown>
>;

export const passwordless = (base: string) =>
  fetcher<
    | RouteRegisterToken
    | RouteSigninVerify
    | RouteCredentialsList
    | RouteCredentialsDelete
  >("fetch", { base: base });

export type Passwordless = ReturnType<typeof passwordless>;
