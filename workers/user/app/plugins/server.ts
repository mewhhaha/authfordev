import { decodeHeader } from "@internal/keys";
import { type PluginContext, type Plugin } from "@mewhhaha/little-router";
import { error } from "@mewhhaha/typed-response";
import { type TaggedType } from "@internal/common";

export const server_ = (async (
  {
    request,
  }: PluginContext<{
    init: {
      headers: {
        Authorization: string;
      };
    };
  }>,
  env: Env
) => {
  const header = request.headers.get("Authorization");
  if (header === null) {
    return error(401, { message: "authorization_missing" });
  }

  const app = await decodeHeader(env.SECRET_FOR_SERVER, "server", header);
  if (app === undefined) {
    return error(403, { message: "authorization_invalid" });
  }

  return { app: app as ServerAppName };
}) satisfies Plugin<[Env]>;

export type ServerAppName = TaggedType<string, "server_app_name">;
