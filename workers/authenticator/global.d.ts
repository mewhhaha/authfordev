import { type TaggedType } from "@internal/common";
import "@mewhhaha/little-worker";

declare global {
  type Env = {
    KV_AUTHENTICATOR: TaggedType<KVNamespace, "kv_authenticator">;
  };
}

declare module "@mewhhaha/little-worker" {
  interface RouteData {
    arguments: [Env, ExecutionContext];
  }
}
