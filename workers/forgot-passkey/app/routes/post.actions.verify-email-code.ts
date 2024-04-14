import { type } from "arktype";
import { $challenge } from "../objects/challenge.js";
import { parseClaim } from "../helpers/parser.js";
import { server_ } from "../plugins/server.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { route, err, ok } from "@mewhhaha/little-worker";
import { decode } from "@mewhhaha/little-worker/crypto";

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
      return err(403, message);
    }

    const challenge = $challenge(env.DO_CHALLENGE, claim.jti);
    const response = await challenge.post("/finish", { body: code });
    if (!response.ok) {
      return err(403, { message: "challenge_expired" });
    }

    const [userId, email] = (await response.text()).split(":");
    if (userId === undefined || email === undefined) {
      return err(401, { message: "challenge_invalid" });
    }

    return ok(200, { userId, email: decode(email) });
  }
);
