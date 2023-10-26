import { route } from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { hashAlias, kvAlias } from "../helpers/alias.js";
import { server_ } from "../plugins/server.js";

export default route(
  PATTERN,
  [
    server_,
    data_(
      type({
        aliases: "string<60[]",
      })
    ),
  ],
  async ({ app, data: { aliases } }, env) => {
    const result = await Promise.all(
      aliases.map(async (alias) => {
        const hashedAlias = await hashAlias(env.SECRET_FOR_ALIAS, alias);
        return await env.KV_ALIAS.get(kvAlias(app, hashedAlias)).then(
          (result) => [alias, result !== null] as const
        );
      })
    );
    return ok(200, { aliases: result });
  }
);
