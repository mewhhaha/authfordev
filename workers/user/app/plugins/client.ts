import { decodeHeader } from "@internal/keys";
import { type PluginContext, err, type Plugin } from "@mewhhaha/little-worker";
import { type TaggedType } from "@mewhhaha/little-worker/tagged";

export const client_ = (async (
  {
    request,
  }: PluginContext<{
    init: { body: string; headers?: { "Content-Type": "text/plain" } };
  }>,
  env: Env
) => {
  const clientKey = await request.text();

  if (clientKey === "") {
    return err(401, { message: "body_missing" });
  }

  const app = await decodeHeader(env.SECRET_FOR_CLIENT, "client", clientKey);
  if (app === undefined || app === "") {
    return err(403, { message: "authorization_invalid" });
  }

  return { app: app as ClientAppName };
}) satisfies Plugin<[Env]>;

export type ClientAppName = TaggedType<string, "server_app_name">;
