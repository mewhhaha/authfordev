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

const dash = /-/g;
const underscore = /_/g;
const plus = /\+/g;
const slash = /\//g;
const equals = /=+$/;

export const decode = (str: string) => {
  str = str.replace(dash, "+").replace(underscore, "/");
  while (str.length % 4) {
    str += "=";
  }
  return atob(str);
};

export const encode = (str: string) => {
  let base64 = btoa(str);
  return base64.replace(plus, "-").replace(slash, "_").replace(equals, "");
};
