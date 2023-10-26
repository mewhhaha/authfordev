import { route } from "@mewhhaha/little-router";
import { server_ } from "../plugins/server.js";
import { tryResult } from "@internal/common";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { parsedBoolean } from "../helpers/parser.js";
import { $passkey, guardPasskey } from "../passkey.js";

export default route(
  PATTERN,
  [server_, query_(type({ "visitors?": parsedBoolean }))],
  async (
    { app, query: { visitors = false }, params: { userId, passkeyId } },
    env
  ) => {
    const jurisdiction = env.DO_PASSKEY.jurisdiction("eu");
    const passkey = $passkey(jurisdiction, passkeyId);
    const guard = guardPasskey(app, userId);
    const { success, result } = await passkey
      .get(`/data?visitors=${visitors}`, {
        headers: { Authorization: guard },
      })
      .then(tryResult);

    if (!success) {
      return error(404, "passkey_missing");
    }

    return ok(200, result);
  }
);
