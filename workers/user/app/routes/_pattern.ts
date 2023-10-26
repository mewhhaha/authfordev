declare global {
  interface ServiceWorkerGlobalScope {
    PATTERN: string;
  }
}

self.PATTERN = "";
declare module "./delete.users.$userId.passkeys.$passkeyId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/passkeys/:passkeyId";
}
declare module "./get.aliases.$alias.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/aliases/:alias";
}
declare module "./get.users.$userId.passkeys.$passkeyId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/passkeys/:passkeyId";
}
declare module "./get.users.$userId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId";
}
declare module "./post.actions.check-aliases.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/actions/check-aliases";
}
declare module "./post.actions.send-email-code.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/actions/send-email-code";
}
declare module "./post.actions.verify-email-code.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/actions/verify-email-code";
}
declare module "./post.actions.verify-passkey.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/actions/verify-passkey";
}
declare module "./post.client.challenge-passkey.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/client/challenge-passkey";
}
declare module "./post.users.$userId.passkeys.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/passkeys";
}
declare module "./post.users.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users";
}
declare module "./put.users.$userId.rename-passkey.$passkeyId.js" {
  /** This is an ephemeral value and can only be used as a type */
  const PATTERN = "/users/:userId/rename-passkey/:passkeyId";
}
