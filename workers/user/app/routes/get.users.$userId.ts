import { route } from "@mewhhaha/little-router";
import { server_ } from "../plugins/server.js";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { tryResult } from "@internal/common";
import { error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { parsedBoolean } from "../helpers/parser.js";
import { $user, guardUser } from "../user.js";

export default route(
  PATTERN,
  [
    server_,
    query_(type({ "recovery?": parsedBoolean, "passkeys?": parsedBoolean })),
  ],
  async (
    {
      app,
      query: { recovery = false, passkeys = false },
      params: { userId: userIdString },
    },
    env
  ) => {
    const jurisdiction = env.DO_USER.jurisdiction("eu");
    const user = $user(jurisdiction, userIdString);
    const { success, result } = await user
      .get(`/data?recovery=${recovery}&passkeys=${passkeys}`, {
        headers: { Authorization: guardUser(app) },
      })
      .then(tryResult);

    if (!success) {
      return error(404, { message: "user_missing" });
    }

    return ok(200, result);
  }
);