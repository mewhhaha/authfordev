import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { authfordev } from "~/api/authfordev";

export async function action({ request, context: { env } }: DataFunctionArgs) {
  const formData = await request.formData();
  const buffer = [];
  for (let i = 0; i < 6; i++) {
    const part = formData.get(`otp[${i}]`)?.toString() ?? "";
    if (part.length !== 1) return { success: false } as const;

    buffer.push(part);
  }

  const code = buffer.join("");
  const slip = formData.get("slip")?.toString();
  const username = formData.get("username")?.toString();

  if (!code || !slip || !username) return { success: false } as const;

  const api = authfordev("https://user.authfor.dev");

  const response = await api.post("/verify-device", {
    headers: {
      "Content-Type": "application/json",
      Authorization: env.AUTHFOR_AUTHORIZATION,
    },
    body: JSON.stringify({ username, code, slip }),
  });

  if (!response.ok) {
    console.error(await response.text());
    return { success: false, code } as const;
  }

  const { token } = await response.json();

  return { success: true, code, token } as const;
}
