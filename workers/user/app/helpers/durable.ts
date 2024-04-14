import { DurableObject } from "cloudflare:workers";

export const $get = <DURABLE_OBJECT extends DurableObject>(
  namespace: DurableObjectNamespace<DURABLE_OBJECT>,
  id: string | DurableObjectId,
) => namespace.get(typeof id === "string" ? namespace.idFromString(id) : id);

/**
 * A decorator that retrieves and sets the value in storage on the Durable Object. The key it sets it to is the same as the accessor name.
 *
 * @example
 * ```ts
 * import { DurableObject } from "cloudflare:workers";
 * import { store, storage } from "../helpers/durable";
 *
 * class Foobar extends DurableObject {
 *  \@storage
 *  accessor #message = store("");
 * }
 * ```
 */
export const storage = <V, T extends DurableObject = DurableObject>(
  target: ClassAccessorDecoratorTarget<T, Promise<V>>,
  ctx: ClassAccessorDecoratorContext,
): ClassAccessorDecoratorResult<T, Promise<V>> => {
  return {
    /**
     * Initializes the Durable Object with the stored value, if available.
     */
    async init(this: T, value: Promise<V>): Promise<V> {
      const storedValue = await this.ctx.storage.get<V>(ctx.name.toString());
      return storedValue !== undefined ? storedValue : value;
    },

    async get(this: T): Promise<V> {
      return target.get.call(this);
    },

    /**
     * Sets the value internally and also sets it in the storage as a side effect.
     */
    set(this: T, value: Promise<V>) {
      this.ctx.waitUntil(
        value.then((v) => {
          void this.ctx.storage.put(ctx.name.toString(), v); // Make sure this value is awaited before storing it.
        }),
      );

      target.set.call(this, value);
    },
  };
};

type Store = {
  <V>(value: V): Promise<V>;
  <V>(): Promise<V | undefined>;
};

/**
 * A shorthand for Promise.resolve to more easily set values in conjunction with \@storage
 *
 * @example
 * ```ts
 * import { DurableObject } from "cloudflare:workers";
 * import { store, storage } from "../helpers/durable";
 *
 * class Foobar extends DurableObject {
 *    \@storage
 *    accessor #message: Promise<string> = store("");
 *
 *    async setMessage(message: string) {
 *      // this.#message = Promise.resolve(message);
 *      this.#message = store(message);
 *    }
 * }
 * ```
 */
export const store: Store = <V>(value?: V) => Promise.resolve(value);
