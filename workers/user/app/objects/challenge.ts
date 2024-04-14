import { DurableObject } from "cloudflare:workers";
import { storage, store } from "../helpers/durable";

type Start = {
  ms: number;
  code?: string;
  value?: string;
};

export class DurableObjectChallenge extends DurableObject {
  @storage
  accessor #valid = store(false);

  @storage
  accessor #code = store<string>();

  @storage
  accessor #value = store<string>("");

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env);
  }

  async start({ ms, code, value }: Start) {
    this.#valid = store(true);

    if (code !== undefined) this.#code = store(code);
    if (value !== undefined) this.#value = store(value);

    const expiry = new Date(Date.now() + ms);
    void this.ctx.storage.setAlarm(expiry);
  }

  async finish(code?: string) {
    const valid = await this.#valid;
    if (!valid) {
      return { error: true, message: "challenge_expired" } as const;
    }

    this.#valid = store(false);
    void this.ctx.storage.deleteAll();
    void this.ctx.storage.deleteAlarm();

    if (await this.#code.then((c) => c !== undefined && code !== c)) {
      return { error: true, message: "code_mismatch" } as const;
    }

    return { error: false, data: await this.#value } as const;
  }

  async alarm() {
    this.#valid = store(false);
    await this.ctx.storage.deleteAll();
  }
}
