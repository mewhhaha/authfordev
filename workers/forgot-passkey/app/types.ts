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
    SECRET_KEY: string;
    DO_USER: TaggedDurableObjectNamespace<"do_user">;
    DO_CHALLENGE: TaggedDurableObjectNamespace<"do_challenge">;
    DO_PASSKEY: TaggedDurableObjectNamespace<"do_passkey">;
  };
}

declare module "@mewhhaha/little-worker" {
  interface RouteData {
    extra: [Env, ExecutionContext];
  }
}
