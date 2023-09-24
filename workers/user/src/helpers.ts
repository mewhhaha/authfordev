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
    const promises = keys.map(async (key) => {
      const value = await t.storage.get<(typeof t)[typeof key]>(key as string);
      if (value) t[key] = value;
    });

    return Promise.all(promises);
  };

export const storageSaver =
  <THIS extends Record<any, any>>(
    t: { storage: DurableObjectStorage } & THIS
  ) =>
  async <KEY extends KeyofValues<THIS>>(key: KEY, value: THIS[KEY]) => {
    t[key as keyof typeof t] = value;
    t.storage.put(key as string, value);
  };
