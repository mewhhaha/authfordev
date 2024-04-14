import { type } from "arktype";
import { server_ } from "../plugins/server.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { route, ok } from "@mewhhaha/little-worker";
import { $get } from "../helpers/durable.js";

export default route(
  PATTERN,
  [
    server_,
    data_(
      type({
        username: "string<60",
      }),
    ),
  ],
  async ({ data: { username } }, env) => {
    const user = $get(env.DO_USER, env.DO_USER.idFromName(username));
    return ok(200, { exists: await user.exists() });
  },
);
