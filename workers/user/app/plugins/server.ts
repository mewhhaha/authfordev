import { type PluginContext, err, type Plugin } from "@mewhhaha/little-worker";
import { type TaggedType } from "@mewhhaha/little-worker/tagged";

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
  env: Env,
) => {
  const header = request.headers.get("Authorization");
  if (header === null) {
    return err(401, { message: "authorization_missing" });
  }

  if (header !== env.SECRET_KEY) {
    return err(403, { message: "authorization_invalid" });
  }

  return {};
}) satisfies Plugin<[Env]>;

export type ServerAppName = TaggedType<string, "server_app_name">;
