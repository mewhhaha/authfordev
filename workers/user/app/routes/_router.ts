import { Router, type RouteData } from "@mewhhaha/little-worker";
import route_0 from "./delete.users.$userId.passkeys.$passkeyId.js";
import route_1 from "./get.users.$userId.passkeys.$passkeyId.js";
import route_2 from "./get.users.$userId.js";
import route_3 from "./patch.users.$userId.passkeys.$passkeyId.js";
import route_4 from "./post.actions.check-username.js";
import route_5 from "./post.actions.verify-passkey.js";
import route_6 from "./post.client.challenges.js";
import route_7 from "./post.users.$userId.passkeys.js";
import route_8 from "./post.users.js";
export const router = Router<
  RouteData["extra"] extends unknown[] ? RouteData["extra"] : []
>()
  .delete("/users/:userId/passkeys/:passkeyId", route_0[1], route_0[2])
  .get("/users/:userId/passkeys/:passkeyId", route_1[1], route_1[2])
  .get("/users/:userId", route_2[1], route_2[2])
  .patch("/users/:userId/passkeys/:passkeyId", route_3[1], route_3[2])
  .post("/actions/check-username", route_4[1], route_4[2])
  .post("/actions/verify-passkey", route_5[1], route_5[2])
  .post("/client/challenges", route_6[1], route_6[2])
  .post("/users/:userId/passkeys", route_7[1], route_7[2])
  .post("/users", route_8[1], route_8[2]);
const routes = router.infer;
export type Routes = typeof routes;
declare module "./delete.users.$userId.passkeys.$passkeyId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/passkeys/:passkeyId";
}
declare module "./get.users.$userId.passkeys.$passkeyId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/passkeys/:passkeyId";
}
declare module "./get.users.$userId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId";
}
declare module "./patch.users.$userId.passkeys.$passkeyId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/passkeys/:passkeyId";
}
declare module "./post.actions.check-username.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/actions/check-username";
}
declare module "./post.actions.verify-passkey.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/actions/verify-passkey";
}
declare module "./post.client.challenges.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/client/challenges";
}
declare module "./post.users.$userId.passkeys.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/passkeys";
}
declare module "./post.users.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users";
}
