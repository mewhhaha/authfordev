import { server_ } from "../plugins/server.js";
import { type } from "arktype";
import { initJSON } from "@internal/common";
import { $challenge } from "../challenge.js";
import { parseRegistrationToken } from "../helpers/parser.js";
import { $passkey, guardPasskey } from "../passkey.js";
import { $user, makePasskeyLink, guardUser } from "../user.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { route, err, ok } from "@mewhhaha/little-worker";

export default route(
  PATTERN,
  [server_, data_(type({ token: "string", origin: "string" }))],
  async (
    { app, params: { userId: userIdString }, data: { token, origin } },
    env,
    ctx
  ) => {
    const jurisdiction = {
      user: env.DO_USER.jurisdiction("eu"),
      passkey: env.DO_PASSKEY.jurisdiction("eu"),
    };

    const { registration, claim, message } = await parseRegistrationToken(
      token,
      { app, secret: env.SECRET_FOR_PASSKEY }
    );
    if (message !== undefined) {
      return err(403, { message });
    }

    const challenge = $challenge(env.DO_CHALLENGE, claim.jti);
    const { ok: passed } = await challenge.post("/finish");
    if (!passed) {
      return err(403, { message: "challenge_expired" });
    }

    const credentialId = registration.credential.id;

    const passkeyId = jurisdiction.passkey.idFromName(credentialId);
    const passkey = $passkey(jurisdiction.passkey, passkeyId);

    const userId = jurisdiction.user.idFromString(userIdString);
    const user = $user(jurisdiction.user, userId);

    const data = {
      app,
      userId: userId.toString(),
      registration,
      origin,
      challengeId: claim.jti,
      visitor: claim.vis,
    };
    const { ok: registered } = await passkey.post(
      "/start-register",
      initJSON(data)
    );
    if (!registered) {
      return err(403, { message: "passkey_exists" });
    }

    const passkeyLink = makePasskeyLink({ passkeyId, credentialId, userId });
    const guard = guardUser(app);
    const linked = await user.post(
      "/link-passkey",
      initJSON(passkeyLink, { Authorization: guard })
    );
    if (linked === undefined) {
      return err(404, { message: "user_missing" });
    }

    ctx.waitUntil(
      passkey.post("/finish-register", {
        headers: { Authorization: guardPasskey(app, userId) },
      })
    );

    return ok(201, {
      userId,
      passkeyId: passkeyId.toString(),
    });
  }
);
