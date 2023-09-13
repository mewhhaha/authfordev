export const signApplication = (
  salt: string,
  { slug, secret }: { slug: string; secret: string }
) => {
  if (slug.includes("#")) {
    throw new Error("Invalid slug");
  }

  return signData(salt, `${slug}#${secret}`);
};

const signData = async (
  salt: string,
  message: string,
  { hash = "SHA-256" }: { hash?: string } = {}
) => {
  const encoder = new TextEncoder();

  const secretKeyData = encoder.encode(salt);
  const key = await crypto.subtle.importKey(
    "raw",
    secretKeyData,
    { name: "HMAC", hash },
    false,
    ["sign"]
  );

  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

  return btoa(String.fromCharCode(...new Uint8Array(mac)));
};
