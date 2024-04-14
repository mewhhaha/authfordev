import { ok, route } from "@mewhhaha/little-worker";
import { server_ } from "../plugins/server.js";
import { $get } from "../helpers/durable.js";

export default route(
  PATTERN,
  [server_],
  async ({ params: { userId: userIdString } }, env) => {
    const user = $get(env.DO_USER, userIdString);
    const data = await user.data();
    return ok(200, data);
  },
);
