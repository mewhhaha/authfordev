/// <reference types="@remix-run/dev" />
/// <reference types="@cloudflare/workers-types" />

import "@remix-run/cloudflare";

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    env: {
      D1: D1Database;
      SECRET_FOR_SERVER: string;
      SECRET_FOR_CLIENT: string;
    };
  }
}
