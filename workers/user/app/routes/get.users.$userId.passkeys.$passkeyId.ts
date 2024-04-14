import { server_ } from "../plugins/server.js";
import { route, ok } from "@mewhhaha/little-worker";
import { $get } from "../helpers/durable.js";

export default route(
  PATTERN,
  [server_],
  async ({ params: { userId, passkeyId } }, env) => {
    const passkey = $get(env.DO_PASSKEY, passkeyId);

    const { metadata, visitors } = await passkey.data(userId);
    return ok(200, { metadata, visitors });
  },
);
