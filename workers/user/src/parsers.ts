import { Type, scope, type } from "arktype";

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
  { keys: "strict" }
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
      name: "string",
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
  { keys: "strict" }
);

export type RegistrationParsed = typeof parseRegistrationParsed.infer;

export const parseSigninEncoded = type(
  {
    credentialId: "string",
    authenticatorData: "string",
    clientData: "string",
    signature: "string",
  },
  { keys: "strict" }
);

export type SigninEncoded = typeof parseSigninEncoded.infer;
