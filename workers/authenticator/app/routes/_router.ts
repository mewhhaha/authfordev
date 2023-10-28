import { Router, type RouteData } from "@mewhhaha/little-worker";
import * as PATTERN from "./_pattern.js";
import route_0 from "./get.authenticators.$aaguid.js";
import route_1 from "./get.authenticators.js";
if (typeof PATTERN === "undefined") {
  throw new Error("missing PATTERN import");
}
export const router = Router<
  RouteData["arguments"] extends unknown[] ? RouteData["arguments"] : []
>()
  .get("/authenticators/:aaguid", route_0[1], route_0[2])
  .get("/authenticators", route_1[1], route_1[2]);
const routes = router.infer;
/** @public */
export type Routes = typeof routes;
