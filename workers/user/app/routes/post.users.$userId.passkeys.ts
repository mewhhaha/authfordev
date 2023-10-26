import { route } from "@mewhhaha/little-router";
import { type ServerAppName, server_ } from "../plugins/server.js";
import { data_ } from "@mewhhaha/little-router-plugin-data";
import { type } from "arktype";
import { encode, jsonBody, tryResult } from "@internal/common";
import { error, ok } from "@mewhhaha/typed-response";
import { server } from "@passwordless-id/webauthn";
import { $challenge } from "../challenge.js";
import {
  type Credential,
  type Visitor,
  parseRegistrationToken,
} from "../helpers/parser.js";
import { $passkey } from "../passkey.js";
import {
  $user,
  makePasskeyLink,
  guardUser,
  type GuardUser,
  type PasskeyLink,
} from "../user.js";

export default route(
  PATTERN,
  [server_, data_(type({ token: "string", origin: "string" }))],
  async (
    { app, params: { userId: userIdString }, data: { token, origin } },
    env
  ) => {
    const jurisdiction = {
      user: env.DO_USER.jurisdiction("eu"),
      passkey: env.DO_PASSKEY.jurisdiction("eu"),
    };

    const { message, credential, visitor } = await verifyRegistration(
      token,
      env.DO_CHALLENGE,
      { app, origin, secret: env.SECRET_FOR_PASSKEY }
    );
    if (message !== undefined) {
      return error(403, { message });
    }

    const passkeyId = jurisdiction.passkey.idFromName(credential.id);
    const userId = jurisdiction.user.idFromString(userIdString);
    const user = $user(jurisdiction.user, userId);
    const passkeyLink = makePasskeyLink({ passkeyId, credential, userId });
    const guard = guardUser(app);
    const linked = await linkPasskey(user, { passkeyLink, guard });
    if (linked === undefined) {
      return error(404, { message: "user_missing" });
    }

    const passkey = $passkey(jurisdiction.passkey, passkeyId);
    const payload = { app, visitor, userId, credential };
    await createPasskey(passkey, payload);

    return ok(201, {
      userId,
      passkeyId: passkeyId.toString(),
    });
  }
);

const verifyRegistration = async (
  token: string,
  namespace: Env["DO_CHALLENGE"],
  {
    app,
    origin,
    secret,
  }: { app: ServerAppName; origin: string; secret: Env["SECRET_FOR_PASSKEY"] }
) => {
  try {
    const { registrationEncoded, claim, message } =
      await parseRegistrationToken(token, {
        app,
        secret,
      });
    if (message !== undefined) {
      return { message } as const;
    }

    const challenge = $challenge(namespace, claim.jti);
    const { success: passed } = await finishChallenge(challenge);
    if (!passed) {
      return { message: "challenge_expired" } as const;
    }

    const registrationParsed = await server.verifyRegistration(
      registrationEncoded,
      { challenge: encode(claim.jti), origin }
    );

    const { credential } = registrationParsed;

    return {
      credential,

      visitor: claim.vis,
    } as const;
  } catch {
    return { message: "passkey_invalid" } as const;
  }
};

const createPasskey = async (
  passkey: ReturnType<typeof $passkey>,
  data: {
    userId: DurableObjectId | string;
    app: ServerAppName;
    credential: Credential;
    visitor: Visitor;
  }
) => {
  return await passkey.post(
    "/occupy",
    jsonBody({ ...data, userId: `${data.userId.toString()}` })
  );
};

const linkPasskey = async (
  user: ReturnType<typeof $user>,
  {
    guard,
    passkeyLink,
  }: {
    guard: GuardUser;
    passkeyLink: PasskeyLink;
  }
) => {
  return await user
    .post("/link-passkey", jsonBody(passkeyLink, guard))
    .then(tryResult);
};

const finishChallenge = async (challenge: ReturnType<typeof $challenge>) => {
  return await challenge.post("/finish").then(tryResult);
};
