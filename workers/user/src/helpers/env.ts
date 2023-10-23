export type Env = {
  API_URL_MAILCHANNELS: string;
  SECRET_FOR_SERVER: string;
  SECRET_FOR_CLIENT: string;
  SECRET_FOR_PASSKEY: string;
  D1: D1Database;
  DO_USER: DurableObjectNamespace;
  DO_CHALLENGE: DurableObjectNamespace;
  DO_PASSKEY: DurableObjectNamespace;
  KV_ALIAS: KVNamespace;
  DKIM_PRIVATE_KEY: string;
};
