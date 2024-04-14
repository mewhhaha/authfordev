import {
  type Credential,
  type Visitor,
  type VisitedHeaders,
  RegistrationEncoded,
  AuthenticationEncoded,
} from "../helpers/parser.js";
import { now } from "../helpers/time.js";
import { server } from "@passwordless-id/webauthn";
import { encode } from "@mewhhaha/little-worker/crypto";
import { DurableObject } from "cloudflare:workers";
import { storage, store } from "../helpers/durable.js";

const VISITOR_HISTORY_LENGTH = 10;

type Registration = {
  userId: string;
  registration: RegistrationEncoded;
  challengeId: string;
  origin: string;
  visited: VisitedHeaders;
};

type TryAuthenticate = {
  challengeId: string;
  origin: string;
  authentication: AuthenticationEncoded;
  visited: VisitedHeaders;
};

/** @public */
export type Metadata = {
  passkeyId: string;
  credentialId: string;
  userId: string;
  createdAt: string;
};

export type Passkey = {
  credential: Credential;
  metadata: Metadata;
};

export class DurableObjectPasskey extends DurableObject<Env> {
  @storage
  accessor #metadata = store<Metadata | undefined>(undefined);

  @storage
  accessor #credential = store<Credential | undefined>(undefined);

  @storage
  accessor #counter = store<number>(-1);

  @storage
  accessor #visitors = store<Visitor[]>([]);

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async data(userId: string) {
    const { metadata, visitors } = await this.#assertPasskey(userId);

    return { metadata, visitors };
  }

  async start({ registration, visited, challengeId, userId }: Registration) {
    await this.#assertEmpty();

    try {
      const checks = {
        challenge: encode(challengeId),
        origin,
      };
      const { authenticator, credential } = await server.verifyRegistration(
        registration,
        checks,
      );

      const metadata: Metadata = {
        userId,
        passkeyId: this.ctx.id.toString(),
        credentialId: credential.id,
        createdAt: now(),
      };

      this.#credential = store(credential);
      this.#metadata = store(metadata);

      const visitors = [makeVisitor(visited, authenticator.aaguid)];

      this.#visitors = store(visitors);

      const tenMinutesFromNow = new Date(Date.now() + 1000 * 60 * 10);
      void this.ctx.storage.setAlarm(tenMinutesFromNow);

      return { error: false, data: metadata } as const;
    } catch (e) {
      return { error: true, message: "registration_failed" } as const;
    }
  }

  async finish(userId: string) {
    await this.#assertPasskey(userId);

    void this.ctx.storage.deleteAlarm();
  }

  async authenticate({
    authentication,
    challengeId,
    visited,
  }: TryAuthenticate) {
    const { metadata, credential, counter } = await this.#assertPasskey();

    try {
      const { authenticator } = await server.verifyAuthentication(
        authentication,
        credential,
        {
          origin,
          challenge: encode(challengeId),
          counter,
          userVerified: true,
        },
      );

      this.#counter = store(
        authenticator.counter === 0 ? -1 : authenticator.counter,
      );

      this.#visitors = this.#visitors.then((vs) => {
        const visitor = makeVisitor(visited, authenticator.aaguid);
        return [visitor, ...vs].slice(0, VISITOR_HISTORY_LENGTH);
      });

      return { error: false, data: metadata } as const;
    } catch (e) {
      if (e instanceof Error) console.log(e);
      return { error: true, message: "authentication_failed" } as const;
    }
  }

  /** self destruct the passkey, deleting all the data */
  async destruct() {
    void this.ctx.storage.deleteAll();
    void this.ctx.storage.deleteAlarm();

    // get the metadata before clearing the field so we can return it
    const metadata = await this.#metadata;

    this.#metadata = store(undefined);
    this.#credential = store(undefined);
    this.#visitors = store([]);
    this.#counter = store(-1);

    return metadata;
  }

  async alarm() {
    await this.destruct();
  }

  async #assertPasskey(userId?: string) {
    const metadata = await this.#metadata;
    const credential = await this.#credential;
    const counter = await this.#counter;
    const visitors = await this.#visitors;

    if (metadata === undefined) {
      throw new Error("Object is unoccupied");
    }

    if (userId !== undefined && userId !== metadata.userId) {
      throw new Error("UserId mismatch");
    }

    if (credential === undefined) {
      throw new Error("Credential missing");
    }

    return { credential, metadata, userId, counter, visitors };
  }

  async #assertEmpty() {
    const metadata = await this.#metadata;

    if (metadata !== undefined) {
      throw new Error("Object is occupied");
    }
  }
}

export const getVisitedHeaders = (request: Request): VisitedHeaders => {
  return {
    city: request.headers.get("cf-ipcity") ?? undefined,
    country: request.headers.get("cf-ipcountry") ?? undefined,
    continent: request.headers.get("cf-ipcontinent") ?? undefined,
    longitude: request.headers.get("cf-iplongitude") ?? undefined,
    latitude: request.headers.get("cf-iplatitude") ?? undefined,
    region: request.headers.get("cf-region") ?? undefined,
    regionCode: request.headers.get("cf-region-code") ?? undefined,
    metroCode: request.headers.get("cf-metro-code") ?? undefined,
    postalCode: request.headers.get("cf-postal-code") ?? undefined,
    timezone: request.headers.get("cf-timezone") ?? undefined,
  };
};

const makeVisitor = (
  headers: VisitedHeaders,
  authenticator: string,
): Visitor => {
  return {
    ...headers,
    timestamp: now(),
    authenticator,
  };
};
