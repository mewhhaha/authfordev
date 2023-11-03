import { type } from "arktype";
import { server_ } from "../plugins/server.js";
import { $user, guardUser } from "../objects/user.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { initJSON } from "@mewhhaha/little-worker/init";
import { route, err, ok } from "@mewhhaha/little-worker";

export default route(
  PATTERN,
  [server_, data_(type({ name: "string" }))],
  async ({ app, data, params: { userId, passkeyId } }, env) => {
    const jurisdiction = {
      passkey: env.DO_PASSKEY.jurisdiction("eu"),
      user: env.DO_USER.jurisdiction("eu"),
    };

    const user = $user(jurisdiction.user, userId);
    const response = await user.put(
      `/rename-passkey/${passkeyId}`,
      initJSON(data, { Authorization: guardUser(app) })
    );

    if (!response.ok) {
      return err(404, { message: "passkey_missing" });
    }

    return ok(200, data);
  }
);
