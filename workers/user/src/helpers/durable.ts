import { fetcher } from "@mewhhaha/little-fetcher";
import { type RoutesOf } from "@mewhhaha/little-router";

type KeyofValues<T extends Record<any, any>> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? never
    : K extends "storage"
    ? never
    : K;
}[keyof T];

export const storageLoader =
  <THIS extends Record<any, any>>(
    t: { storage: DurableObjectStorage } & THIS
  ) =>
  async <KEY extends KeyofValues<THIS>>(...keys: KEY[]) => {
    const promises = async () => {
      const map = await t.storage.get<THIS[keyof THIS]>(keys as string[]);
      for (const [key, value] of map.entries()) {
        if (value !== undefined) t[key as keyof THIS] = value;
      }
    };

    await promises();
  };

export const storageSaver =
  <THIS extends Record<any, any>>(
    t: { storage: DurableObjectStorage } & THIS
  ) =>
  <KEY extends KeyofValues<THIS>>(key: KEY, value: THIS[KEY]) => {
    t[key as keyof typeof t] = value;
    void t.storage.put(key as string, value);
  };

export const $any = <
  OBJECT extends { router: any },
  NAMESPACE extends DurableObjectNamespace = DurableObjectNamespace,
>(
  namespace: NAMESPACE,
  id: string | DurableObjectId
) =>
  fetcher<RoutesOf<OBJECT["router"]>>(
    namespace.get(typeof id === "string" ? namespace.idFromString(id) : id)
  );
