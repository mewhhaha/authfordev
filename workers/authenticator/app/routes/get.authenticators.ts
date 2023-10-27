import { route } from "@mewhhaha/little-router";
import { type JSONResponse, ok } from "@mewhhaha/typed-response";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { scope } from "arktype";
import { type Authenticator } from "../types";
import { createCacheHeaders } from "../cache";

const parseQueries = scope({
  union: "cursor|ids|empty|limit",
  ids: {
    ids: "1<string[]<100",
    "cursor?": "undefined",
  },
  cursor: {
    cursor: "string",
    "limit?": "1<=number<=1000",
    "ids?": "undefined",
  },
  limit: {
    "limit?": "1<=number<=1000",
    "ids?": "undefined",
    "cursor?": "undefined",
  },
  empty: { "ids?": "undefined", "cursor?": "undefined", "limit?": "undefined" },
}).compile().union;

export default route(
  PATTERN,
  [query_(parseQueries)],
  async ({ request, query }, env, ctx) => {
    const cache = caches.default;
    const cachedResponse = await cache.match(request);
    if (cachedResponse !== undefined) {
      return cachedResponse;
    }

    let response: JSONResponse<
      200,
      { items: Authenticator[]; cursor?: string; complete: boolean }
    >;
    if (query.ids !== undefined) {
      const values = (
        await Promise.all(
          query.ids.map((id) =>
            env.KV_AUTHENTICATOR.get<Authenticator>(id, "json")
          )
        )
      ).filter(isAuthenticator);

      response = ok(
        200,
        { items: values, cursor: undefined, complete: true },
        { headers: createCacheHeaders(request) }
      );
    } else {
      const items = await env.KV_AUTHENTICATOR.list({
        cursor: query.cursor,
        limit: query.limit ?? 100,
      });
      const values = (
        await Promise.all(
          items.keys.map((key) =>
            env.KV_AUTHENTICATOR.get<Authenticator>(key.name, "json")
          )
        )
      ).filter(isAuthenticator);

      response = ok(
        200,
        {
          items: values,
          cursor: items.list_complete === true ? undefined : items.cursor,
          complete: items.list_complete,
        },
        { headers: createCacheHeaders(request) }
      );
    }

    ctx.waitUntil(cache.put(request, response.clone()));

    return response;
  }
);

const isAuthenticator = (value: Authenticator | null): value is Authenticator =>
  value !== null;
