import { type PluginContext, Router } from "@mewhhaha/little-router";
import { empty, err, text } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { $any, storageLoader, storageSaver } from "./helpers/durable.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
export { type JSONString } from "@mewhhaha/json-string";

const code_ = (_: PluginContext<{ init?: { body?: string } }>) => {
  return {};
};

export class DurableObjectChallenge implements DurableObject {
  valid = false;
  code?: string;
  value: string = "";

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
      [data_(type({ ms: "number", "code?": "string", "value?": "string" }))],
      async ({ data: { ms, code, value } }, object) => {
        object.save("valid", true);

        if (code !== undefined) {
          object.save("code", code);
        }

        if (value !== undefined) {
          object.save("value", value);
        }

        const expiry = new Date(Date.now() + ms);
        void object.storage.setAlarm(expiry);
        return empty(204);
      }
    )
    .post("/finish", [code_], async ({ request }, object) => {
      if (!object.valid) return err(403, { message: "challenge_expired" });

      object.valid = false;
      void object.storage.deleteAll();
      void object.storage.deleteAlarm();

      if (object.code !== undefined && (await request.text()) !== object.code) {
        return err(403, { message: "code_mismatch" });
      }
      return text(200, object.value);
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

export const $challenge = $any<
  typeof DurableObjectChallenge,
  Env["DO_CHALLENGE"]
>;
