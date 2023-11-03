import { Router, type RouteData } from "@mewhhaha/little-worker";
import route_0 from "./get.authenticators.$aaguid.js";
import route_1 from "./get.authenticators.js";
export const router = Router<
  RouteData["extra"] extends unknown[] ? RouteData["extra"] : []
>()
  .get("/authenticators/:aaguid", route_0[1], route_0[2])
  .get("/authenticators", route_1[1], route_1[2]);
const routes = router.infer;
export type Routes = typeof routes;
declare module "./get.authenticators.$aaguid.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/authenticators/:aaguid";
}
declare module "./get.authenticators.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/authenticators";
}
