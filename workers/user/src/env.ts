export interface Env {
  API_URL_PASSWORDLESS: string;
  API_URL_MAILCHANNELS: string;
  SECRET_FOR_PRIVATE_KEY: string;
  SECRET_FOR_PUBLIC_KEY: string;
  SECRET_FOR_SIGNIN: string;
  SECRET_FOR_REGISTER: string;
  D1: D1Database;
  DO_USER: DurableObjectNamespace;
  DO_WEBAUTHN: DurableObjectNamespace;
  DKIM_PRIVATE_KEY: string;
}
