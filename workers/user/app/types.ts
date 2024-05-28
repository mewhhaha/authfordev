import "@mewhhaha/little-worker";
import {
  DurableObjectChallenge,
  DurableObjectPasskey,
  DurableObjectUser,
} from "./worker";

declare global {
  type Env = {
    SECRET_KEY: string;
    AUDIENCE: string;
    DO_USER: DurableObjectNamespace<DurableObjectUser>;
    DO_CHALLENGE: DurableObjectNamespace<DurableObjectChallenge>;
    DO_PASSKEY: DurableObjectNamespace<DurableObjectPasskey>;
    ENVIRONMENT?: "test";
  };
}

declare module "@mewhhaha/little-worker" {
  interface RouteData {
    extra: [Env, ExecutionContext];
  }
}
