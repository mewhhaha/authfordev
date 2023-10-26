import { decode, tryResult } from "@internal/common";
import { route } from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { $challenge } from "../challenge.js";
import { parseClaim } from "../helpers/parser.js";
import { server_ } from "../plugins/server.js";

export default route(
  PATTERN,
  [server_, data_(type({ token: "string", code: "string" }))],
  async ({ data: { token, code }, app }, env) => {
    const { message, claim } = await parseClaim(
      env.SECRET_FOR_SEND_CODE,
      app,
      token
    );
    if (message !== undefined) {
      return error(403, message);
    }

    const challenge = $challenge(env.DO_CHALLENGE, claim.jti);
    const { success: passed, result } = await finishChallenge(challenge, code);
    if (!passed) {
      return error(403, { message: "challenge_expired" });
    }

    const [userId, email] = result.split(":");
    if (userId === undefined || email === undefined) {
      return error(401, { message: "challenge_invalid" });
    }

    return ok(200, { userId, email: decode(email) });
  }
);

const finishChallenge = async (
  challenge: ReturnType<typeof $challenge>,
  code: string
) => {
  return await challenge.post("/finish", { body: code }).then(tryResult);
};
