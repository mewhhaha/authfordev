import { type } from "arktype";
import { server_ } from "../plugins/server.js";
import { makePasskeyLink } from "../objects/user.js";
import { parseRegistrationToken } from "../helpers/parser.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { route, err, ok } from "@mewhhaha/little-worker";
import { $get } from "../helpers/durable.js";

export default route(
  PATTERN,
  [
    server_,
    data_(
      type({
        username: "2<=string<=60",
        "email?": "string",
        token: "string",
        origin: "string",
      }),
    ),
  ],
  async ({ data: { email, username, token, origin } }, env) => {
    const { registration, claim, message } = await parseRegistrationToken(
      token,
      { secret: env.SECRET_KEY },
    );
    if (message !== undefined) {
      return err(403, { message });
    }

    const challenge = $get(env.DO_CHALLENGE, claim.jti);

    {
      const response = await challenge.finish();
      if (response.error) {
        return err(403, { message: response.message });
      }
    }

    const credentialId = registration.credential.id;
    const passkey = $get(
      env.DO_PASSKEY,
      env.DO_PASSKEY.idFromName(credentialId),
    );
    const user = $get(env.DO_USER, env.DO_USER.idFromName(username));

    const data = {
      userId: user.id.toString(),
      registration,
      origin,
      challengeId: claim.jti,
      visited: claim.vis,
    };

    using response = await passkey.start(data);
    if (!response.error) {
      return err(403, { message: response.message });
    }

    const passkeyLink = makePasskeyLink({
      passkeyId: passkey.id,
      credentialId,
      userId: user.id,
    });

    const payload = { email, username, passkey: passkeyLink };
    try {
      await user.create(payload);
    } catch {
      return err(403, { message: "user_exists" });
    }

    return ok(201, {
      userId: user.id.toString(),
      passkeyId: passkey.id.toString(),
    });
  },
);
