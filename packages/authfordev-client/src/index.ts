import { Routes } from "@mewhhaha/authfordev-api";
import { fetcher } from "@mewhhaha/little-fetcher";
import { client } from "@passwordless-id/webauthn";
import { encode, decode } from "@internal/jwt";

const Client = ({
  apiUrl,
  publicKey,
}: {
  apiUrl: string;
  publicKey: string;
}) => {
  let controller: AbortController;
  const api = fetcher<Routes>("fetch", { base: apiUrl });

  const signin = async ({}: {}) => {
    controller?.abort();
    controller = new AbortController();

    try {
      const response = await api.post("/client/signin-device", {
        headers: { Authorization: publicKey },
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

      const authentication = await client.authenticate([], jti);

      const signinToken = `${token}#${encode(JSON.stringify(authentication))}`;

      return { success: true, token: signinToken } as const;
    } catch (e) {
      return {
        success: false,
        reason:
          e instanceof Error && e.name === "AbortError"
            ? "signin_aborted"
            : "error_unknown",
      } as const;
    }
  };

  const register = async (token: string, code: string) => {
    controller?.abort();
    controller = new AbortController();

    const response = await api.post("/client/register-device", {
      headers: { "Content-Type": "application/json", Authorization: publicKey },
      body: JSON.stringify({ token, code }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        reason: await response.json().then((r) => r.message),
      } as const;
    }

    if (response.status === 401) {
      return {
        success: false,
        reason: "publicKey missing",
      } as const;
    }
  };

  return {
    signin,
    register,
  };
};
