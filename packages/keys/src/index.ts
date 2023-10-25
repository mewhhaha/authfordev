import { hmac, encode } from "@internal/common";

const encoder = new TextEncoder();

export const encodeHeader = async (
  salt: string,
  key: "client" | "server",
  id: string
) => {
  const value = `${id}:${key}`;

  const hash = await hmac(salt, value);
  return `${value}:${encode(hash)}`;
};

export const decodeHeader = async (
  salt: string,
  key: "client" | "server",
  header: string
) => {
  const [app, k, encodedHash] = header.split(":");

  if (!app || key !== k || !encodedHash) {
    return undefined;
  }

  if (encode(await hmac(salt, `${app}:${k}`)) !== encodedHash) {
    return undefined;
  }

  return app;
};
