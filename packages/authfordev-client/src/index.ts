import { Routes } from "@mewhhaha/authfordev-api";
import { fetcher } from "@mewhhaha/little-fetcher";
import { client } from "@passwordless-id/webauthn";
import { encode, decode } from "@internal/jwt";

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
      const response = await api.post("/client/signin-device", {
        headers: { Authorization: clientKey },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          success: false,
          reason: await response.json().then((r) => r.message),
        } as const;
      }

      const { token } = await response.json();

      const [_header, payload] = token.split(".");

      const { jti }: { jti: string } = JSON.parse(decode(payload));

      const authentication = await client.authenticate([], encode(jti), {
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

  const register = async (token: string, code: string, username: string) => {
    try {
      const [_header, payload] = token.split(".");
      const { jti }: { jti: string } = JSON.parse(decode(payload));

      const registration = await client.register(username, encode(jti), {
        userVerification: "required",
        discoverable: "required",
        userHandle: crypto.randomUUID(),
      });

      const registrationToken = `${token}#${encode(
        JSON.stringify(registration)
      )}#${encode(code)}`;

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
