import { fetcher } from "@mewhhaha/little-fetcher";
import { RoutesOf } from "@mewhhaha/little-router";

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
        if (value) t[key as keyof THIS] = value;
      }
    };

    return promises();
  };

export const storageSaver =
  <THIS extends Record<any, any>>(
    t: { storage: DurableObjectStorage } & THIS
  ) =>
  async <KEY extends KeyofValues<THIS>>(key: KEY, value: THIS[KEY]) => {
    t[key as keyof typeof t] = value;
    t.storage.put(key as string, value);
  };

const encoder = new TextEncoder();
export const hmac = async (
  salt: string,
  message: string,
  { hash = "SHA-256" }: { hash?: string } = {}
) => {
  const secretKeyData = encoder.encode(salt);
  const key = await crypto.subtle.importKey(
    "raw",
    secretKeyData,
    { name: "HMAC", hash: { name: hash } },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  return [...new Uint8Array(signature)]
    .map((b) => String.fromCharCode(b))
    .join("");
};

export const $any = <T extends { router: any }>(
  namespace: DurableObjectNamespace,
  id: string | DurableObjectId
) =>
  fetcher<RoutesOf<T["router"]>>(
    namespace.get(typeof id === "string" ? namespace.idFromString(id) : id)
  );
