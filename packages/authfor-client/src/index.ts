import { fetcher } from "@mewhhaha/little-fetcher";
import { client } from "@passwordless-id/webauthn";
import { Routes } from "@mewhhaha/authfor-api";
import { encode, decode } from "@mewhhaha/little-worker/dist/helpers/crypto";

export const Client = ({
  apiUrl = "https://user.authfor.dev",
  clientKey,
}: {
  apiUrl?: string;
  clientKey: string;
}) => {
  let controller: AbortController;
  const api = fetcher<Routes>("fetch", { base: apiUrl });

  const signin = async () => {
    controller?.abort();
    controller = new AbortController();

    try {
      const response = await api.post(`/client/challenge-passkey`, {
        body: clientKey,
        headers: {
          "Content-Type": "text/plain",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          success: false,
          reason: await response.json().then((r) => r.message),
        } as const;
      }

      const { token } = await response.json();

      const challenge = getJwtChallenge(token);

      const authentication = await client.authenticate([], encode(challenge), {
        userVerification: "required",
      });

      const signinToken = `${token}#${encode(JSON.stringify(authentication))}`;

      return { success: true, token: signinToken } as const;
    } catch (e) {
      return {
        success: false,
        reason: "signin_aborted",
      } as const;
    }
  };

  const register = async (username: string) => {
    controller?.abort();
    controller = new AbortController();

    try {
      const response = await api.post(`/client/challenge-passkey`, {
        body: clientKey,
        headers: {
          "Content-Type": "text/plain",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          success: false,
          reason: await response.json().then((r) => r.message),
        } as const;
      }

      const { token } = await response.json();

      const challenge = getJwtChallenge(token);

      const registration = await client.register(username, encode(challenge), {
        userVerification: "required",
        discoverable: "required",
        userHandle: crypto.randomUUID(),
      });

      const registrationToken = `${token}#${encode(
        JSON.stringify(registration)
      )}`;

      return { success: true, token: registrationToken } as const;
    } catch (e) {
      return {
        success: false,
        reason: "register_aborted",
      } as const;
    }
  };

  return {
    signin,
    register,
  };
};

export type AuthforDevClient = ReturnType<typeof Client>;

const getJwtChallenge = (token: string) => {
  const [_header, payload] = token.split(".");
  const { jti }: { jti: string } = JSON.parse(decode(payload));
  return jti;
};
