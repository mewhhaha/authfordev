import { server_ } from "../plugins/server.js";
import { type } from "arktype";
import { jsonBody, tryResult } from "@internal/common";
import { $challenge } from "../challenge.js";
import { parseRegistrationToken } from "../helpers/parser.js";
import { $passkey, guardPasskey } from "../passkey.js";
import {
  $user,
  makePasskeyLink,
  guardUser,
  type GuardUser,
  type PasskeyLink,
} from "../user.js";
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
    const { success: passed } = await finishChallenge(challenge);
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
    const { success: registered } = await passkey
      .post("/start-register", jsonBody(data))
      .then(tryResult);
    if (!registered) {
      return err(403, { message: "passkey_exists" });
    }

    const passkeyLink = makePasskeyLink({ passkeyId, credentialId, userId });
    const guard = guardUser(app);
    const linked = await linkPasskey(user, { passkeyLink, guard });
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

const linkPasskey = async (
  user: ReturnType<typeof $user>,
  {
    guard,
    passkeyLink,
  }: {
    guard: GuardUser;
    passkeyLink: PasskeyLink;
  }
) => {
  return await user
    .post("/link-passkey", jsonBody(passkeyLink, guard))
    .then(tryResult);
};

const finishChallenge = async (challenge: ReturnType<typeof $challenge>) => {
  return await challenge.post("/finish").then(tryResult);
};
