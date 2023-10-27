export type Authenticator = {
  aaguid: string;
  name: string;
  icon: {
    /** base64 encoded image */
    light?: string;
    /** base64 encoded image */
    dark?: string;
  };
};

export type AuthenticatorMetadata = {
  aaguid: string;
  name: string;
};

export type FIDO2Authenticator = {
  aaguid: string;
  metadataStatement: MetadataStatement;
  statusReports: StatusReport[];
  timeOfLastStatusChange: Date;
};

export type MetadataStatement = {
  legalHeader: string;
  aaguid: string;
  description: string;
  authenticatorVersion: number;
  protocolFamily: string;
  schema: number;
  upv: Upv[];
  authenticationAlgorithms: string[];
  publicKeyAlgAndEncodings: string[];
  attestationTypes: string[];
  userVerificationDetails: Array<UserVerificationDetail[]>;
  keyProtection: string[];
  matcherProtection: string[];
  cryptoStrength: number;
  attachmentHint: string[];
  tcDisplay: string[];
  tcDisplayContentType: string;
  attestationRootCertificates: string[];
  icon: string;
  authenticatorGetInfo: AuthenticatorGetInfo;
};

export type AuthenticatorGetInfo = {
  versions: string[];
  extensions: string[];
  aaguid: string;
  options: Options;
  maxMsgSize: number;
  pinUvAuthProtocols: number[];
};

export type Options = {
  plat: boolean;
  rk: boolean;
  clientPin: boolean;
  up: boolean;
};

export type Upv = {
  major: number;
  minor: number;
};

export type UserVerificationDetail = {
  userVerificationMethod: string;
};

export type StatusReport = {
  status: string;
  effectiveDate: Date;
};
