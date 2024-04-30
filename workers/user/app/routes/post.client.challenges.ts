import { jwtTime, encodeJwt } from "@internal/jwt";
import { minute1 } from "../helpers/time.js";
import { getVisitedHeaders } from "../objects/passkey.js";
import { type VisitedHeaders } from "../helpers/parser.js";
import { route, ok } from "@mewhhaha/little-worker";
import { $get } from "../helpers/durable.js";

export default route(PATTERN, [], async ({ request }, env, ctx) => {
  const id = env.DO_CHALLENGE.newUniqueId();

  const claim = {
    jti: id.toString(),
    sub: "anonymous",
    exp: jwtTime(minute1()),
    vis: getVisitedHeaders(request),
    aud: env.AUDIENCE,
  };

  const token = await encodeJwt<{ vis: VisitedHeaders }>(env.SECRET_KEY, claim);

  const challenge = $get(env.DO_CHALLENGE, id);
  ctx.waitUntil(challenge.start({ ms: 60000 }));

  return ok(200, { token }, { headers: cors(request) });
});

const cors = (request: Request) => ({
  "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "",
  "Access-Control-Allow-Method": "POST",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
});
