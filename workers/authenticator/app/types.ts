/** @public */
export type Authenticator = {
  aaguid: string;
  metadataStatement: MetadataStatement;
  statusReports: StatusReport[];
  timeOfLastStatusChange: Date;
};

/** @public */
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

/** @public */
export type AuthenticatorGetInfo = {
  versions: string[];
  extensions: string[];
  aaguid: string;
  options: Options;
  maxMsgSize: number;
  pinUvAuthProtocols: number[];
};

/** @public */
export type Options = {
  plat: boolean;
  rk: boolean;
  clientPin: boolean;
  up: boolean;
};

/** @public */
export type Upv = {
  major: number;
  minor: number;
};

/** @public */
export type UserVerificationDetail = {
  userVerificationMethod: string;
};

/** @public */
export type StatusReport = {
  status: string;
  effectiveDate: Date;
};
