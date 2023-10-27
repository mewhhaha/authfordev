import { route } from "@mewhhaha/little-router";
import { err, ok } from "@mewhhaha/typed-response";
import { createCacheHeaders } from "../cache";

export default route(PATTERN, [], async ({ request, params }, env, ctx) => {
  const cache = caches.default;
  const cachedResponse = await cache.match(request);
  if (cachedResponse !== undefined) {
    return cachedResponse;
  }

  const value = await env.KV_AUTHENTICATOR.get(params.aaguid, "text");

  if (value === null) {
    return err(404, { message: "aaguid_missing" });
  }

  const response = ok(200, value, {
    headers: createCacheHeaders(request),
  });

  ctx.waitUntil(cache.put(request, response.clone()));

  return response;
});
