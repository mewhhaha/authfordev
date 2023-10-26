import { route } from "@mewhhaha/little-router";
import { ok } from "@mewhhaha/typed-response";
import { server_ } from "../plugins/server.js";
import { hashAlias, kvAlias } from "../helpers/alias.js";

export default route(
  PATTERN,
  [server_],
  async ({ app, params: { alias } }, env) => {
    const kvKey = kvAlias(app, await hashAlias(env.SECRET_FOR_ALIAS, alias));
    const userId = await env.KV_ALIAS.get(kvKey);
    return ok(200, { userId: userId ?? undefined });
  }
);
