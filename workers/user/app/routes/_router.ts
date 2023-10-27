import { Router, type RouteData } from "@mewhhaha/little-router";
declare global {
  interface ServiceWorkerGlobalScope {
    PATTERN: string;
  }
}

self.PATTERN = "";
declare module "./delete.users.$userId.passkeys.$passkeyId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/passkeys/:passkeyId";
}
declare module "./get.aliases.$alias.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/aliases/:alias";
}
declare module "./get.users.$userId.passkeys.$passkeyId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/passkeys/:passkeyId";
}
declare module "./get.users.$userId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId";
}
declare module "./post.actions.check-aliases.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/actions/check-aliases";
}
declare module "./post.actions.send-email-code.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/actions/send-email-code";
}
declare module "./post.actions.verify-email-code.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/actions/verify-email-code";
}
declare module "./post.actions.verify-passkey.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/actions/verify-passkey";
}
declare module "./post.client.challenge-passkey.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/client/challenge-passkey";
}
declare module "./post.users.$userId.passkeys.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/passkeys";
}
declare module "./post.users.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users";
}
declare module "./put.users.$userId.rename-passkey.$passkeyId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/rename-passkey/:passkeyId";
}
const d = <T,>(r: { default: T }) => r.default;
const route0 = import("./delete.users.$userId.passkeys.$passkeyId.js").then(d);
const route1 = import("./get.aliases.$alias.js").then(d);
const route2 = import("./get.users.$userId.passkeys.$passkeyId.js").then(d);
const route3 = import("./get.users.$userId.js").then(d);
const route4 = import("./post.actions.check-aliases.js").then(d);
const route5 = import("./post.actions.send-email-code.js").then(d);
const route6 = import("./post.actions.verify-email-code.js").then(d);
const route7 = import("./post.actions.verify-passkey.js").then(d);
const route8 = import("./post.client.challenge-passkey.js").then(d);
const route9 = import("./post.users.$userId.passkeys.js").then(d);
const route10 = import("./post.users.js").then(d);
const route11 = import("./put.users.$userId.rename-passkey.$passkeyId.js").then(
  d,
);
export const router = Router<
  RouteData["arguments"] extends unknown[] ? RouteData["arguments"] : []
>()
  .delete(
    "/users/:userId/passkeys/:passkeyId",
    (await route0)[1],
    (await route0)[2],
  )
  .get("/aliases/:alias", (await route1)[1], (await route1)[2])
  .get(
    "/users/:userId/passkeys/:passkeyId",
    (await route2)[1],
    (await route2)[2],
  )
  .get("/users/:userId", (await route3)[1], (await route3)[2])
  .post("/actions/check-aliases", (await route4)[1], (await route4)[2])
  .post("/actions/send-email-code", (await route5)[1], (await route5)[2])
  .post("/actions/verify-email-code", (await route6)[1], (await route6)[2])
  .post("/actions/verify-passkey", (await route7)[1], (await route7)[2])
  .post("/client/challenge-passkey", (await route8)[1], (await route8)[2])
  .post("/users/:userId/passkeys", (await route9)[1], (await route9)[2])
  .post("/users", (await route10)[1], (await route10)[2])
  .put(
    "/users/:userId/rename-passkey/:passkeyId",
    (await route11)[1],
    (await route11)[2],
  );
const routes = router.infer;
export type Routes = typeof routes;
