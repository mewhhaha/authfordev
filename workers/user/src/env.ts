export interface Env {
  API_URL_MAILCHANNELS: string;
  SECRET_FOR_SERVER: string;
  SECRET_FOR_CLIENT: string;
  SECRET_FOR_SIGNIN: string;
  SECRET_FOR_REGISTER: string;
  D1: D1Database;
  DO_USER: DurableObjectNamespace;
  DKIM_PRIVATE_KEY: string;
}
