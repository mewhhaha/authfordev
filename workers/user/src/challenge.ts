import { fetcher } from "@mewhhaha/little-fetcher";
import { PluginContext, Router, RoutesOf } from "@mewhhaha/little-router";
import { empty, error, ok } from "@mewhhaha/typed-response";
import { query_ } from "@mewhhaha/little-router-plugin-query";
import { type } from "arktype";
import { storageLoader, storageSaver } from "./helpers";

const code_ = ({}: PluginContext<{ init?: { body?: string } }>) => {
  return {};
};

export class DurableObjectChallenge implements DurableObject {
  valid = false;
  code?: string;

  storage: DurableObjectStorage;

  load = storageLoader<DurableObjectChallenge>(this);
  save = storageSaver<DurableObjectChallenge>(this);

  constructor(state: DurableObjectState) {
    this.storage = state.storage;

    state.blockConcurrencyWhile(async () => {
      await this.load("valid");
    });
  }

  static router = Router<[DurableObjectChallenge]>()
    .post(
      "/start",
      [
        code_,
        query_(
          type({
            "ms?": "parsedNumber",
          })
        ),
      ],
      async ({ request, query: { ms = 60000 } }, self) => {
        self.save("valid", true);

        const code = await request.text();
        if (code) {
          self.save("code", code);
        }

        const expiry = new Date(Date.now() + ms);
        self.storage.setAlarm(expiry);
        return empty(204);
      }
    )
    .post("/finish", [code_], async ({ request }, self) => {
      if (!self.valid) return error(403, { message: "challenge_expired" });
      self.valid = false;
      self.storage.deleteAll();

      if (self.code && (await request.text()) !== self.code) {
        return error(403, { message: "code_mismatch" });
      }
      return empty(204);
    })
    .all("/*", [], () => {
      return new Response("Not found", { status: 404 });
    });

  async alarm() {
    this.valid = false;
    await this.storage.deleteAll();
  }

  fetch(
    request: Request<unknown, CfProperties<unknown>>
  ): Response | Promise<Response> {
    return DurableObjectChallenge.router.handle(request, this);
  }
}

export const $challenge = (
  namespace: DurableObjectNamespace,
  id: string | DurableObjectId
) =>
  fetcher<RoutesOf<(typeof DurableObjectChallenge)["router"]>>(
    namespace.get(typeof id === "string" ? namespace.idFromString(id) : id)
  );
