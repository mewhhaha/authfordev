import { jsonBody, tryResult } from "@internal/common";
import { type } from "arktype";
import { $challenge } from "../challenge.js";
import { parseAuthenticationToken } from "../helpers/parser.js";
import { $passkey } from "../passkey.js";
import { server_ } from "../plugins/server.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { route, err, ok } from "@mewhhaha/little-worker";

export default route(
  PATTERN,
  [server_, data_(type({ token: "string", origin: "string" }))],
  async ({ app, data: { origin, token } }, env) => {
    const jurisdiction = { passkey: env.DO_PASSKEY.jurisdiction("eu") };

    const { authentication, challengeId, visitor, message } =
      await parseAuthenticationToken(token, {
        app,
        secret: env.SECRET_FOR_PASSKEY,
      });
    if (message === "token_invalid") {
      return err(401, "token_invalid");
    }

    if (message !== undefined) {
      return err(403, message);
    }

    const challenge = $challenge(env.DO_CHALLENGE, challengeId);
    const { success: passed } = await finishChallenge(challenge);
    if (!passed) {
      return err(410, { message: "challenge_expired" });
    }

    const passkeyId = jurisdiction.passkey.idFromName(
      authentication.credentialId
    );
    const passkey = $passkey(jurisdiction.passkey, passkeyId);

    const payload = { app, origin, challengeId, visitor, authentication };
    const response = await passkey.post("/authenticate", jsonBody(payload));

    if (!response.ok) {
      return err(403, { message: "passkey_invalid" });
    }

    const { metadata } = await response.json();

    return ok(200, {
      userId: metadata.userId,
      passkeyId: metadata.passkeyId,
    });
  }
);

const finishChallenge = async (challenge: ReturnType<typeof $challenge>) => {
  return await challenge.post("/finish").then(tryResult);
};
