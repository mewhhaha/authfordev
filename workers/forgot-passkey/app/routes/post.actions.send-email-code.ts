import { encodeJwt, jwtTime } from "@internal/jwt";
import { type } from "arktype";
import { $challenge } from "../objects/challenge.js";
import { hashAlias, kvAlias } from "../helpers/alias.js";
import { createBody, sendEmail } from "../helpers/email.js";
import { server_ } from "../plugins/server.js";
import { $user, guardUser } from "../objects/user.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { route, err, ok } from "@mewhhaha/little-worker";
import { invariant } from "@mewhhaha/little-worker/invariant";
import { encode } from "@mewhhaha/little-worker/crypto";
import { initJSON } from "@mewhhaha/little-worker/init";

export default route(
  PATTERN,
  [server_, data_(type({ alias: "string", "email?": "email" }))],
  async ({ data: { alias, email: specifiedAddress }, app }, env, ctx) => {
    const jurisdiction = env.DO_USER.jurisdiction("eu");
    const code = generateCode(8);

    const hashedAlias = await hashAlias(env.SECRET_FOR_ALIAS, alias);
    const userId = await env.KV_ALIAS.get(kvAlias(app, hashedAlias));
    if (userId === null) {
      return err(404, { message: "user_missing" });
    }

    const response = await $user(jurisdiction, userId).get(
      "/data?recovery=true",
      { headers: { Authorization: guardUser(app) } }
    );
    if (!response.ok) {
      console.log("Alias didn't result in a proper user for some reason");
      return err(404, { message: "user_missing" });
    }

    const { recovery } = await response.json();
    invariant(recovery, "included because of query param");

    const address = recovery.emails.find((e) => {
      if (specifiedAddress === undefined) {
        return e.primary && e.verified;
      } else {
        return e.address === specifiedAddress;
      }
    })?.address;

    if (address === undefined) {
      return err(400, { message: "email_missing" });
    }

    const body = createBody({
      email: address,
      username: alias,
      dkim: env.DKIM_PRIVATE_KEY,
      code,
    });

    const challengeId = env.DO_CHALLENGE.newUniqueId();

    const minute30 = 1000 * 60 * 30;

    const challenge = $challenge(env.DO_CHALLENGE, challengeId);

    const postSend = async () => {
      await Promise.all([
        sendEmail(env.API_URL_MAILCHANNELS, body),
        startChallenge(challenge, {
          ms: minute30,
          code,
          value: `${userId}:${encode(address)}`,
        }),
      ]);
    };

    ctx.waitUntil(postSend());

    const claim = encodeJwt(env.SECRET_FOR_SEND_CODE, {
      jti: challengeId.toString(),
      sub: "anonymous",
      exp: jwtTime(new Date(Date.now() + minute30)),
      aud: app,
    });

    return ok(202, { token: claim });
  }
);

const generateCode = (numberOfCharacters: number) => {
  const buffer = new Uint8Array(numberOfCharacters);
  const randomBuffer = crypto.getRandomValues(buffer);
  return [...randomBuffer]
    .map((value) => CHARACTERS[value % CHARACTERS.length])
    .join("");
};

const CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const startChallenge = async (
  challenge: ReturnType<typeof $challenge>,
  data: { ms: number; code: string; value: string }
) => await challenge.post(`/start`, initJSON(data));
