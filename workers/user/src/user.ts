import { fetcher } from "@mewhhaha/little-fetcher";
import { Router, RoutesOf } from "@mewhhaha/little-router";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { error, ok } from "@mewhhaha/typed-response";
import { type } from "arktype";
import { storageLoader, storageSaver } from "./helpers";

import { server } from "@passwordless-id/webauthn";
import { RegistrationParsed } from "@passwordless-id/webauthn/dist/esm/types";

const parseRegister = type({
  username: "string",
  credential: {
    id: "string",
    publicKey: "string",
    algorithm: "'RS256' | 'ES256'",
  },
  authenticatorData: "string",
  clientData: "string",
  "attestationData?": "string",
});

const parseSignin = type({
  credentialId: "string",
  authenticatorData: "string",
  clientData: "string",
  signature: "string",
});

type Challenge = {
  type: "register" | "signin";
  session: string;
  code?: string;
  expiry: Date;
};

export class DurableObjectUser implements DurableObject {
  challenge?: Challenge;

  email: string = "";
  verified: boolean = false;

  credentials: RegistrationParsed[] = [];

  storage: DurableObjectStorage;

  save = storageSaver<DurableObjectUser>(this);
  load = storageLoader<DurableObjectUser>(this);

  constructor(state: DurableObjectState) {
    this.storage = state.storage;

    state.blockConcurrencyWhile(async () => {
      await this.load("email", "verified", "credentials", "challenge");
    });
  }

  initialize(email: string) {
    this.save("email", email);
  }

  findCredential(id: string) {
    return this.credentials.find((c) => c.credential.id === id);
  }

  static router = Router<[DurableObjectUser]>()
    .post(
      "/occupy/challenge",
      [data_(type({ email: "email" }))],
      async ({ data }, u) => {
        if (u.verified) {
          return error(409, { message: "user_verified" });
        }
        u.initialize(data.email);

        const challenge = generateChallenge("register", {
          expiry: hour1,
          code: true,
        });
        u.save("challenge", challenge);

        return ok(200, {
          email: u.email,
          code: challenge.code as string,
          session: challenge.session,
        });
      }
    )
    .post("/register/challenge", [], async (_, u) => {
      if (!u.email) {
        return error(404, { message: "user_missing" });
      }
      const challenge = generateChallenge("register", {
        expiry: hour1,
        code: true,
      });
      u.save("challenge", challenge);

      return ok(200, {
        email: u.email,
        code: challenge.code as string,
        session: challenge.session,
      });
    })
    .post(
      "/register/verify",
      [data_(parseRegister)],
      async ({ url, data }, u) => {
        if (!u.challenge || isExpired(u.challenge)) {
          return error(403, { message: "challenge_expired" });
        }

        try {
          const registration = await server.verifyRegistration(data, {
            challenge: `${u.challenge.type}:${u.challenge.session}:${u.challenge.code}`,
            origin: url.host,
          });

          if (!u.verified) {
            u.save("verified", true);
          }

          u.credentials.push(registration);
          u.save("credentials", u.credentials);
          return ok(200);
        } catch {
          return error(403, { message: "challenge_failed" });
        }
      }
    )
    .post("/signin/challenge", [], async (_, u) => {
      if (!u.email) {
        return error(404, { message: "user_missing" });
      }
      const challenge = generateChallenge("signin", { expiry: minute5 });
      u.save("challenge", challenge);

      return ok(200, {
        code: challenge.code as string,
        session: challenge.session,
        credentialIds: u.credentials.map((r) => r.credential.id),
      });
    })
    .post("/signin/verify", [data_(parseSignin)], async ({ data, url }, u) => {
      if (!u.challenge || isExpired(u.challenge)) {
        return error(403, { message: "challenge_expired" });
      }

      const credential = u.findCredential(data.credentialId);
      if (!credential) {
        return error(403, { message: "credential_missing" });
      }

      try {
        const authentication = await server.verifyAuthentication(
          data,
          credential.credential,
          {
            challenge: `${u.challenge.type}:${u.challenge.session}:${u.challenge.code}`,
            origin: url.host,
            userVerified: true,
            counter: credential.authenticator.counter,
          }
        );

        return ok(200, { authentication });
      } catch {
        return error(403, { message: "challenge_failed" });
      }
    })
    .all("/*", [], () => {
      return new Response("Not found", { status: 404 });
    });

  fetch(
    request: Request<unknown, CfProperties<unknown>>
  ): Response | Promise<Response> {
    return DurableObjectUser.router.handle(request, this);
  }
}

export const $user = (
  namespace: DurableObjectNamespace,
  id: string | DurableObjectId
) =>
  fetcher<RoutesOf<(typeof DurableObjectUser)["router"]>>(
    namespace.get(typeof id === "string" ? namespace.idFromString(id) : id)
  );

const generateCode = (numberOfCharacters: number) => {
  const buffer = new Uint8Array(numberOfCharacters);
  const randomBuffer = crypto.getRandomValues(buffer);
  return [...randomBuffer].map((value) => (value % 10).toString()).join("");
};

const generateChallenge = (
  type: "register" | "signin",
  {
    code,
    expiry,
  }: {
    expiry: number;
    code?: boolean;
    attempts?: number;
  }
) => {
  const challenge: Challenge = {
    type,
    session: crypto.randomUUID(),
    code: code ? generateCode(6) : undefined,
    expiry: new Date(new Date().getTime() + expiry),
  };

  return challenge;
};

const isExpired = (challenge: Challenge) => {
  return new Date().getTime() > challenge.expiry.getTime();
};

const hour1 = 1000 * 60 * 60;
const minute5 = 1000 * 60 * 5;
