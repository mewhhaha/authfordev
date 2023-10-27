import { type TaggedType } from "@internal/common";
import "@mewhhaha/little-router";

declare global {
  type Env = {
    KV_AUTHENTICATOR: TaggedType<KVNamespace, "kv_authenticator">;
  };
}

declare module "@mewhhaha/little-router" {
  interface RouteData {
    arguments: [Env, ExecutionContext];
  }
}
