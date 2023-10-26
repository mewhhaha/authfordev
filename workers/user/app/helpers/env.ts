import { type TaggedType } from "@internal/common";

type TaggedDurableObjectNamespace<T extends string> = TaggedType<
  Omit<DurableObjectNamespace, "jurisdiction"> & {
    jurisdiction: (
      ...params: Parameters<DurableObjectNamespace["jurisdiction"]>
    ) => TaggedDurableObjectNamespace<T>;
  },
  T
>;

export type Env = {
  API_URL_MAILCHANNELS: string;
  SECRET_FOR_SERVER: TaggedType<string, "secret_for_server">;
  SECRET_FOR_CLIENT: TaggedType<string, "secret_for_client">;
  SECRET_FOR_PASSKEY: TaggedType<string, "secret_for_passkey">;
  SECRET_FOR_SEND_CODE: TaggedType<string, "secret_for_send_code">;
  SECRET_FOR_ALIAS: TaggedType<string, "secret_for_alias">;
  D1: D1Database;
  DO_USER: TaggedDurableObjectNamespace<"do_user">;
  DO_CHALLENGE: TaggedDurableObjectNamespace<"do_challenge">;
  DO_PASSKEY: TaggedDurableObjectNamespace<"do_passkey">;
  KV_ALIAS: TaggedType<KVNamespace, "kv_alias">;
  DKIM_PRIVATE_KEY: TaggedType<string, "dkim_private_key">;
};
