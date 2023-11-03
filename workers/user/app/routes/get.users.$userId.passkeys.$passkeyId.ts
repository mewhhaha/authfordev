import { server_ } from "../plugins/server.js";
import { type } from "arktype";
import { parsedBoolean } from "../helpers/parser.js";
import { $passkey, guardPasskey } from "../objects/passkey.js";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { route, err } from "@mewhhaha/little-worker";

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
    const response = await passkey.get(`/data?visitors=${visitors}`, {
      headers: { Authorization: guard },
    });

    if (!response.ok) {
      return err(404, "passkey_missing");
    }

    return response;
  }
);
