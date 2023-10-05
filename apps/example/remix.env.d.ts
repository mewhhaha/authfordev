/// <reference types="@remix-run/dev" />
/// <reference types="@cloudflare/workers-types" />

import "@remix-run/cloudflare";

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    env: {
      SECRET_FOR_AUTH: string;
      AUTH_SERVER_KEY: string;
      AUTH_CLIENT_KEY: string;
    };
  }
}
