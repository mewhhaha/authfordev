import { route, err, ok } from "@mewhhaha/little-worker";
import { createCacheHeaders } from "../cache";
import { type Authenticator } from "../types";

export default route(PATTERN, [], async ({ request, params }, env, ctx) => {
  const cache = caches.default;
  const cachedResponse = await cache.match(request);
  if (cachedResponse !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw cachedResponse;
  }

  const value = await env.KV_AUTHENTICATOR.get<Authenticator>(
    params.aaguid,
    "json"
  );

  if (value === null) {
    return err(404, { message: "aaguid_missing" });
  }

  const response = ok(200, value, {
    headers: createCacheHeaders(request),
  });

  ctx.waitUntil(cache.put(request, response.clone()));

  return response;
});
