import { encode, hmac } from "@mewhhaha/little-worker/crypto";
import { type TaggedType } from "@mewhhaha/little-worker/tagged";
import { type ServerAppName } from "../plugins/server.js";

export type HashedAlias = TaggedType<string, "hashed_alias">;

export const kvAlias = (app: ServerAppName, hashedAlias: HashedAlias) =>
  `#app#${app}#alias#${hashedAlias}`;

export const hashAlias = async (
  secret: Env["SECRET_FOR_ALIAS"],
  alias: string
) => encode(await hmac(secret, alias)) as HashedAlias;

export const hashAliases = async (
  secret: Env["SECRET_FOR_ALIAS"],
  aliases: string[]
) => {
  return await Promise.all(
    aliases.map(async (alias) => await hashAlias(secret, alias))
  );
};
