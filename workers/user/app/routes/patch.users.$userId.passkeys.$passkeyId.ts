import { type } from "arktype";
import { server_ } from "../plugins/server.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { route, ok } from "@mewhhaha/little-worker";
import { $get } from "../helpers/durable.js";

export default route(
  PATTERN,
  [server_, data_(type({ name: "string" }))],
  async ({ data, params: { userId, passkeyId } }, env) => {
    const user = $get(env.DO_USER, userId);
    const passkey = await user.getPasskey(passkeyId);
    await passkey.rename(data.name);

    return ok(200, data);
  },
);
