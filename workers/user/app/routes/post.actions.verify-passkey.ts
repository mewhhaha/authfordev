import { type } from "arktype";
import { parseAuthenticationToken } from "../helpers/parser.js";
import { server_ } from "../plugins/server.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { route, err, ok } from "@mewhhaha/little-worker";
import { $get } from "../helpers/durable.js";

export default route(
  PATTERN,
  [server_, data_(type({ token: "string", origin: "string" }))],
  async ({ data: { origin, token } }, env) => {
    const { authentication, challengeId, visited, message } =
      await parseAuthenticationToken(token, {
        secret: env.SECRET_KEY,
      });
    if (message === "token_invalid") {
      return err(401, "token_invalid");
    }

    if (message !== undefined) {
      return err(403, message);
    }

    const challenge = $get(env.DO_CHALLENGE, challengeId);
    const finished = await challenge.finish();
    if (finished.error) {
      return err(403, { message: finished.message });
    }

    const passkey = $get(
      env.DO_PASSKEY,
      env.DO_PASSKEY.idFromName(authentication.credentialId),
    );

    const payload = { origin, challengeId, visited, authentication };
    const authenticated = await passkey.authenticate(payload);
    if (authenticated.error) {
      return err(403, { message: authenticated.message });
    }

    return ok(200, {
      userId: authenticated.data.userId,
      passkeyId: authenticated.data.passkeyId,
    });
  },
);
