import { server_ } from "../plugins/server.js";
import { type } from "arktype";
import { parseRegistrationToken } from "../helpers/parser.js";
import { makePasskeyLink } from "../objects/user.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { route, err, ok } from "@mewhhaha/little-worker";
import { $get } from "../helpers/durable.js";

export default route(
  PATTERN,
  [server_, data_(type({ token: "string", origin: "string" }))],
  async ({ params: { userId }, data: { token, origin } }, env, ctx) => {
    const { registration, claim, message } = await parseRegistrationToken(
      token,
      { secret: env.SECRET_KEY },
    );
    if (message !== undefined) {
      return err(403, { message });
    }

    const challenge = $get(env.DO_CHALLENGE, claim.jti);
    const finished = await challenge.finish();
    if (finished.error) {
      return err(403, { message: finished.message });
    }

    const credentialId = registration.credential.id;

    const passkey = $get(
      env.DO_PASSKEY,
      env.DO_PASSKEY.idFromName(credentialId),
    );
    const user = $get(env.DO_USER, userId);

    const data = {
      userId: userId,
      registration,
      origin,
      challengeId: claim.jti,
      visited: claim.vis,
    };
    const started = await passkey.start(data);
    if (started.error) {
      return err(403, { message: started.message });
    }

    const passkeyLink = makePasskeyLink({
      passkeyId: passkey.id,
      credentialId,
      userId,
    });

    await user.addPasskey(passkeyLink);

    ctx.waitUntil(passkey.finish(userId));

    return ok(201, {
      userId,
      passkeyId: passkey.id.toString(),
    });
  },
);
