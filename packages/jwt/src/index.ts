import { decode, encode, hmac } from "@mewhhaha/little-worker/crypto";

type JwtClaim<T = Record<never, never>> = {
  jti: string;
  sub: string;
  iat: number;
  exp: number;
  aud: string;
} & T;

export const encodeJwt = async <
  T extends Record<any, any> = Record<never, never>,
>(
  salt: string,
  payload: Omit<JwtClaim<T>, "iat">
) => {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const claim = encode(
    JSON.stringify({
      iat: jwtTime(new Date()),
      ...payload,
    })
  );

  const hash = await hmac(salt, `${header}.${claim}`);

  return `${header}.${claim}.${encode(hash)}`;
};

export const decodeJwt = async <T>(salt: string, jwt: string) => {
  const [encodedHeader, encodedClaim, encodedHash] = jwt.split(".");

  if (
    encode(await hmac(salt, `${encodedHeader}.${encodedClaim}`)) !== encodedHash
  ) {
    return undefined;
  }

  return JSON.parse(decode(encodedClaim)) as JwtClaim<T>;
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

export const jwtTime = (date: Date) => (date.getTime() / 1000) | 0;
export const jwtDate = (num: number) => new Date(num * 1000);
