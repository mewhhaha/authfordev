import { type TaggedType } from "@mewhhaha/little-worker/tagged";
import "@mewhhaha/little-worker";

type TaggedDurableObjectNamespace<T extends string> = TaggedType<
  Omit<DurableObjectNamespace, "jurisdiction"> & {
    jurisdiction: (
      ...params: Parameters<DurableObjectNamespace["jurisdiction"]>
    ) => TaggedDurableObjectNamespace<T>;
  },
  T
>;

declare global {
  type Env = {
    SECRET_KEY: TaggedDurableObjectNamespace<"secret_sign">;
    DO_USER: TaggedDurableObjectNamespace<"do_user">;
    DO_CHALLENGE: TaggedDurableObjectNamespace<"do_challenge">;
    DO_PASSKEY: TaggedDurableObjectNamespace<"do_passkey">;
    DO_ALIAS: TaggedDurableObjectNamespace<"do_alias">;
    KV_CACHE: TaggedType<KVNamespace, "kv_cache">;
  };
}

declare module "@mewhhaha/little-worker" {
  interface RouteData {
    extra: [Env, ExecutionContext];
  }
}
