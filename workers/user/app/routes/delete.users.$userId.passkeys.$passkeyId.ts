import { route, err, ok } from "@mewhhaha/little-worker";
import { server_ } from "../plugins/server.js";
import { $get } from "../helpers/durable.js";

export default route(
  PATTERN,
  [server_],
  async ({ params: { userId, passkeyId } }, env) => {
    const user = $get(env.DO_USER, userId);
    const passkey = await user.getPasskey(passkeyId);

    const response = await passkey.remove();

    if (response.error) {
      return err(404, { message: response.message });
    }

    return ok(200, response.passkey);
  },
);
