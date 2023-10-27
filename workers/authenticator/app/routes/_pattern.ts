declare global {
  interface ServiceWorkerGlobalScope {
    PATTERN: string;
  }
}

self.PATTERN = "";
declare module "./get.authenticators.$aaguid.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/authenticators/:aaguid";
}
declare module "./get.authenticators.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/authenticators";
}
export {};
