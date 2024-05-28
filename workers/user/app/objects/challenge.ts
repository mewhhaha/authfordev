import { DurableObject } from "cloudflare:workers";

type Private = {
  "#valid": boolean;
  "#code": string | undefined;
  "#value": string;
};

type Start = {
  ms: number;
  code?: string;
  value?: string;
};

export class DurableObjectChallenge extends DurableObject {
  #valid: Private["#valid"] = false;
  #code: Private["#code"] = undefined;
  #value: Private["#value"] = "";

  #store<Key extends keyof Private>(key: Key, value: Private[Key]) {
    void this.ctx.storage.put(key.toString(), value);
    return value;
  }

  async #load<Key extends keyof Private>(key: Key) {
    const value = await this.ctx.storage.get<Private[Key]>(key.toString());
    if (value !== undefined) {
      // @ts-expect-error we can't see private variables
      this[key] = value;
    }
  }

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env);
    void state.blockConcurrencyWhile(async () => {
      await Promise.all([
        this.#load("#valid"),
        this.#load("#code"),
        this.#load("#value"),
      ]);
    });
  }

  async start({ ms, code, value }: Start) {
    this.#valid = this.#store("#valid", true);

    if (code !== undefined) {
      this.#code = this.#store("#code", code);
    }
    if (value !== undefined) {
      this.#value = this.#store("#value", value);
    }

    const expiry = new Date(Date.now() + ms);
    void this.ctx.storage.setAlarm(expiry);
  }

  async finish(code?: string) {
    const valid = this.#valid;
    if (!valid) {
      return { error: true, message: "challenge_expired" } as const;
    }

    this.#valid = this.#store("#valid", false);
    void this.ctx.storage.deleteAll();
    void this.ctx.storage.deleteAlarm();

    if (this.#code !== undefined && this.#code !== code) {
      return { error: true, message: "code_mismatch" } as const;
    }

    return { error: false, data: await this.#value } as const;
  }

  async alarm() {
    this.#valid = this.#store("#valid", false);
    await this.ctx.storage.deleteAll();
  }
}
