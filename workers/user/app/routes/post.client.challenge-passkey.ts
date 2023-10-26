import { jwtTime, encodeJwt } from "@internal/jwt";
import { route } from "@mewhhaha/little-router";
import { ok } from "@mewhhaha/typed-response";
import { $challenge } from "../challenge.js";
import { minute1 } from "../helpers/time.js";
import { makeVisitor } from "../passkey.js";
import { client_ } from "../plugins/client.js";
import { type Visitor } from "../worker.js";
import { jsonBody } from "@internal/common";

export default route(PATTERN, [client_], async ({ request, app }, env, ctx) => {
  const id = env.DO_CHALLENGE.newUniqueId();

  const claim = {
    jti: id.toString(),
    sub: "anonymous",
    exp: jwtTime(minute1()),
    vis: makeVisitor(request),
    aud: app,
  };

  const token = await encodeJwt<{ vis: Visitor }>(
    env.SECRET_FOR_PASSKEY,
    claim
  );

  const challenge = $challenge(env.DO_CHALLENGE, id);
  ctx.waitUntil(startChallenge(challenge));

  return ok(200, { token }, { headers: cors(request) });
});

const startChallenge = async (challenge: ReturnType<typeof $challenge>) =>
  await challenge.post(`/start`, jsonBody({ ms: 60000 }));

const cors = (request: Request) => ({
  "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "",
  "Access-Control-Allow-Method": "POST",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
});
