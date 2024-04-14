import { hmac, encode } from "@mewhhaha/little-worker/crypto";

const encoder = new TextEncoder();

export const encodeHeader = async (salt: string, value: string) => {
  const hash = await hmac(salt, value);
  return `${value}:${encode(hash)}`;
};

export const decodeHeader = async (salt: string, header: string) => {
  const [app, k, encodedHash] = header.split(":");

  if (!app || key !== k || !encodedHash) {
    return undefined;
  }

  if (encode(await hmac(salt, `${app}:${k}`)) !== encodedHash) {
    return undefined;
  }

  return app;
};
