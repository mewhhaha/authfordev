/// <reference types="@remix-run/dev" />
/// <reference types="@cloudflare/workers-types" />

import "@remix-run/cloudflare";

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    env: {
      SECRET_FOR_AUTH: string;
      AUTHFOR_AUTHORIZATION: string;
      PASSWORDLESS_PUBLIC_KEY: string;
      PASSWORDLESS_PRIVATE_KEY: string;
      PASSWORDLESS_API_URL: string;
    };
  }
}
