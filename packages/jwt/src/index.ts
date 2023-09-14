type JwtClaim = {
  jti: string;
  sub: string;
  iat: number;
  pk: string;
};

const encoder = new TextEncoder();

export const encodeJwt = async (
  salt: string,
  { id, pk }: { id: string; pk: string }
) => {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(
    JSON.stringify({
      jti: crypto.randomUUID(),
      sub: id,
      iat: (new Date().getTime() / 1000) | 0,
      pk,
    } satisfies JwtClaim)
  );

  console.log(salt);
  const hash = await hmac(salt, `${header}.${payload}`);

  return `${header}.${payload}.${encode(hash)}`;
};

export const decodeJwt = async (salt: string, jwt: string) => {
  const [encodedHeader, encodedPayload, encodedHash] = jwt.split(".");

  if (
    encode(await hmac(salt, `${encodedHeader}.${encodedPayload}`)) !==
    encodedHash
  ) {
    return undefined;
  }

  const payload = decode(encodedPayload);

  const claim = JSON.parse(payload) as JwtClaim;

  return { id: claim.sub, pk: claim.pk };
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

export const createAuthorization = (jwt: string) => {
  return `Bearer ${jwt}`;
};

export const parseJwt = (authorization: string) => {
  const groups = authorization.match(/^Bearer (?<jwt>.+)$/)?.groups;
  const jwt = groups?.jwt;

  if (!jwt) {
    return undefined;
  }

  return jwt;
};

function decode(str: string) {
  str = str.replace("-", "+").replace("_", "/");
  while (str.length % 4) {
    str += "=";
  }
  return atob(str);
}

function encode(str: string) {
  let base64 = btoa(str);
  return base64.replace("+", "-").replace("/", "_").replace(/=+$/, "");
}
