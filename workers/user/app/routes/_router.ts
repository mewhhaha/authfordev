import { Router, type RouteData } from "@mewhhaha/little-worker";
import * as PATTERN from "./_pattern.js";
import route_0 from "./delete.users.$userId.passkeys.$passkeyId.js";
import route_1 from "./get.aliases.$alias.js";
import route_2 from "./get.users.$userId.passkeys.$passkeyId.js";
import route_3 from "./get.users.$userId.js";
import route_4 from "./post.actions.check-aliases.js";
import route_5 from "./post.actions.send-email-code.js";
import route_6 from "./post.actions.verify-email-code.js";
import route_7 from "./post.actions.verify-passkey.js";
import route_8 from "./post.client.challenge-passkey.js";
import route_9 from "./post.users.$userId.passkeys.js";
import route_10 from "./post.users.js";
import route_11 from "./put.users.$userId.rename-passkey.$passkeyId.js";
if (typeof PATTERN === "undefined") {
  throw new Error("missing PATTERN import");
}
export const router = Router<
  RouteData["arguments"] extends unknown[] ? RouteData["arguments"] : []
>()
  .delete("/users/:userId/passkeys/:passkeyId", route_0[1], route_0[2])
  .get("/aliases/:alias", route_1[1], route_1[2])
  .get("/users/:userId/passkeys/:passkeyId", route_2[1], route_2[2])
  .get("/users/:userId", route_3[1], route_3[2])
  .post("/actions/check-aliases", route_4[1], route_4[2])
  .post("/actions/send-email-code", route_5[1], route_5[2])
  .post("/actions/verify-email-code", route_6[1], route_6[2])
  .post("/actions/verify-passkey", route_7[1], route_7[2])
  .post("/client/challenge-passkey", route_8[1], route_8[2])
  .post("/users/:userId/passkeys", route_9[1], route_9[2])
  .post("/users", route_10[1], route_10[2])
  .put("/users/:userId/rename-passkey/:passkeyId", route_11[1], route_11[2]);
const routes = router.infer;
export type Routes = typeof routes;
