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

const hmac = async (
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

const dash = /-/g;
const underscore = /_/g;
const plus = /\+/g;
const slash = /\//g;
const equals = /=+$/;

const decode = (str: string) => {
  str = str.replace(dash, "+").replace(underscore, "/");
  while (str.length % 4) {
    str += "=";
  }
  return atob(str);
};

const encode = (str: string) => {
  let base64 = btoa(str);
  return base64.replace(plus, "-").replace(slash, "_").replace(equals, "");
};
