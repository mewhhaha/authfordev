import { decode } from "@mewhhaha/little-worker/crypto";
import { decodeJwt, jwtTime } from "@internal/jwt";
import { type } from "arktype";

export const parseVisitor = type({
  "city?": "string",
  "country?": "string",
  "continent?": "string",
  "longitude?": "string",
  "latitude?": "string",
  "region?": "string",
  "regionCode?": "string",
  "metroCode?": "string",
  "postalCode?": "string",
  "timezone?": "string",
  authenticator: "string",
  timestamp: "string",
});

export const parseVisitorHeaders = type({
  "city?": "string",
  "country?": "string",
  "continent?": "string",
  "longitude?": "string",
  "latitude?": "string",
  "region?": "string",
  "regionCode?": "string",
  "metroCode?": "string",
  "postalCode?": "string",
  "timezone?": "string",
});

const inferredVisitor = parseVisitor.infer;
/** @public */
export type Visitor = typeof inferredVisitor;

const inferredVisitorHeaders = parseVisitorHeaders.infer;
export type VisitedHeaders = typeof inferredVisitorHeaders;

export const parseCredential = type({
  id: "string",
  publicKey: "string",
  algorithm: "'RS256' | 'ES256'",
});

export type Credential = typeof parseCredential.infer;

export const parseRegistrationEncoded = type(
  {
    username: "string",
    credential: parseCredential,
    authenticatorData: "string",
    clientData: "string",
    "attestationData?": "string",
  },
  { keys: "strict" },
);

export type RegistrationEncoded = typeof parseRegistrationEncoded.infer;

export const parseRegistrationParsed = type(
  {
    username: "string",
    credential: parseCredential,
    authenticator: {
      rpIdHash: "string",
      flags: {
        userPresent: "boolean",
        userVerified: "boolean",
        backupEligibility: "boolean",
        backupState: "boolean",
        attestedData: "boolean",
        extensionsIncluded: "boolean",
      },
      counter: "number",
      aaguid: "string",
      "name?": "string",
    },
    client: {
      type: "'webauthn.create' | 'webauthn.get'",
      challenge: "string",
      origin: "string",
      crossOrigin: "boolean",
      "tokenBindingId?": {
        id: "string",
        status: "string",
      },
      "extensions?": "unknown",
    },
    "attestation?": "unknown",
  },
  { keys: "strict" },
);

export type RegistrationParsed = typeof parseRegistrationParsed.infer;

export const parseAuthenticationEncoded = type(
  {
    credentialId: "string",
    authenticatorData: "string",
    clientData: "string",
    signature: "string",
  },
  { keys: "strict" },
);

export type AuthenticationEncoded = typeof parseAuthenticationEncoded.infer;

export const parsedBoolean = type([
  "'true'|'false'",
  "|>",
  (s: string): boolean => {
    if (s === "true") return true;
    if (s === "false") return false;
    throw new Error("invalid boolean");
  },
]);

export const parseAuthenticationToken = async (
  token: string,
  { secret }: { secret: string },
) => {
  const [tokenRaw, signinRaw] = token.split("#");
  const { claim, message } = await parseClaim<{ vis: VisitedHeaders }>(
    secret,
    tokenRaw,
  );
  if (claim === undefined) {
    return { message };
  }

  const { data: authentication, problems } = parseAuthenticationEncoded(
    JSON.parse(decode(signinRaw)),
  );
  if (problems !== undefined) {
    return { message: "token_invalid" } as const;
  }

  return { authentication, visited: claim.vis, challengeId: claim.jti };
};

export const parseRegistrationToken = async (
  token: string,
  { secret }: { secret: string },
) => {
  const [tokenRaw, registrationRaw] = token.split("#");
  const { claim, message } = await parseClaim<{ vis: VisitedHeaders }>(
    secret,
    tokenRaw,
  );
  if (claim === undefined) {
    return { message } as const;
  }

  const { data: registrationEncoded, problems } = parseRegistrationEncoded(
    JSON.parse(decode(registrationRaw)),
  );
  if (problems !== undefined) {
    return { message: "token_invalid" } as const;
  }

  return { registration: registrationEncoded, claim };
};

export const parseClaim = async <T>(
  secret: string,
  token: string,
  aud?: string,
) => {
  const claim = await decodeJwt<T>(secret, token);
  if (claim === undefined) {
    return { message: "token_invalid" } as const;
  }

  if (jwtTime(new Date()) >= claim.exp) {
    return { message: "token_expired" } as const;
  }

  if (aud !== undefined && claim.aud !== aud) {
    return { message: "audience_mismatch" } as const;
  }

  return { claim } as const;
};
