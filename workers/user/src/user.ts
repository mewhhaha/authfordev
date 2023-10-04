import { fetcher } from "@mewhhaha/little-fetcher";
import {
  Plugin,
  PluginContext,
  Router,
  RoutesOf,
} from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { storageLoader, storageSaver } from "./helpers";

const auth_ = ((
  {
    request,
  }: PluginContext<{
    init: { headers: { Authorization: string } };
  }>,
  u
) => {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return error(401, "authorization_missing");
  }

  if (!u.meta) {
    return error(404, "user_missing");
  }

  if (authorization !== u.meta?.app) {
    return error(403, "authorization_invalid");
  }

  return { meta: u.meta };
}) satisfies Plugin<[DurableObjectUser]>;

type Meta = {
  app: string;
  aliases: string[];
  email: string;
};

export class DurableObjectUser implements DurableObject {
  meta?: Meta;

  storage: DurableObjectStorage;

  private save = storageSaver<DurableObjectUser>(this);
  private load = storageLoader<DurableObjectUser>(this);

  constructor(state: DurableObjectState) {
    this.storage = state.storage;

    state.blockConcurrencyWhile(async () => {
      await this.load("meta");
    });
  }

  occupy({ email, aliases, app }: Meta) {
    this.save("meta", { email, aliases, app });
  }

  static router = Router<[DurableObjectUser]>()
    .post(
      "/occupy",
      [data_(type({ email: "email", app: "string", aliases: "string[]" }))],
      async ({ data }, self) => {
        if (self.meta) {
          return error(403, "user_exists");
        }
        self.occupy(data);
        return ok(200);
      }
    )
    .get("/meta", [auth_], async ({ meta }) => {
      return ok(200, meta);
    })
    .all("/*", [], () => {
      return new Response("Not found", { status: 404 });
    });

  fetch(
    request: Request<unknown, CfProperties<unknown>>
  ): Response | Promise<Response> {
    return DurableObjectUser.router.handle(request, this);
  }
}

export const $user = (
  namespace: DurableObjectNamespace,
  id: string | DurableObjectId
) =>
  fetcher<RoutesOf<(typeof DurableObjectUser)["router"]>>(
    namespace.get(typeof id === "string" ? namespace.idFromString(id) : id)
  );
