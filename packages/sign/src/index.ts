export const signApplication = (
  salt: string,
  { id, pk }: { id: string; pk: string }
) => {
  if (id.includes("#")) {
    throw new Error("Invalid slug");
  }

  return signData(salt, `${id}#${pk}`);
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

export const createAuthorization = ({
  id,
  pk,
  mac,
}: {
  id: string;
  pk: string;
  mac: string;
}) => {
  return `Auth4 id="${id}", pk="${pk}", mac="${mac}"`;
};

export const parseAuthorization = (authorization: string) => {
  const groups = authorization.match(
    /^Auth4 id="(?<id>[^"]+)", pk="(?<pk>[^"]+)", mac="(?<mac>[^"]+)"$/
  )?.groups;
  const pk = groups?.pk;
  const mac = groups?.mac;
  const id = groups?.id;

  if (!pk || !mac || !id) {
    return undefined;
  }

  return { id, pk, mac };
};
