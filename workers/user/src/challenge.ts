import { type PluginContext, Router } from "@mewhhaha/little-router";
import { empty, error } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { $any, storageLoader, storageSaver } from "./helpers/durable";
import { data_ } from "@mewhhaha/little-router-plugin-data";

const code_ = (_: PluginContext<{ init?: { body?: string } }>) => {
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

    void state.blockConcurrencyWhile(async () => {
      await this.load("valid", "code");
    });
  }

  static router = Router<[DurableObjectChallenge]>()
    .post(
      "/start",
      [data_(type({ "ms?": "number", "code?": "string" }))],
      async ({ data: { ms = 60000, code } }, self) => {
        self.save("valid", true);

        if (code !== undefined) {
          self.save("code", code);
        }

        const expiry = new Date(Date.now() + ms);
        void self.storage.setAlarm(expiry);
        return empty(204);
      }
    )
    .post("/finish", [code_], async ({ request }, self) => {
      if (!self.valid) return error(403, { message: "challenge_expired" });

      self.valid = false;
      void self.storage.deleteAll();
      void self.storage.deleteAlarm();

      if (self.code !== undefined && (await request.text()) !== self.code) {
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

export const $challenge = $any<typeof DurableObjectChallenge>;
