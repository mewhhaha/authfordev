import { invariant } from "@internal/common";
import type { DataFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { api } from "~/api/api.js";
import { authenticate } from "~/auth/session.server.js";

export enum PasskeyIntent {
  Rename = "rename",
  Remove = "remove",
}

export async function action({
  request,
  context: { env },
  params: { passkeyId },
}: DataFunctionArgs) {
  const session = await authenticate(request, env.SECRET_FOR_AUTH);
  if (!session) {
    throw redirect("/auth");
  }
  invariant(passkeyId, "passkeyId is part of params");

  const formData = await request.formData();

  const form = {
    intent: formData.get("intent")?.toString(),
    name: formData.get("name")?.toString(),
  };

  switch (form.intent) {
    case PasskeyIntent.Remove: {
      const response = await api.delete(
        `/server/users/${session.userId}/passkeys/${passkeyId}`,
        {
          headers: { Authorization: env.AUTH_SERVER_KEY },
        }
      );
      return { success: response.ok };
    }

    case PasskeyIntent.Rename: {
      if (!form.name) {
        return { success: false, message: "form_data_missing" };
      }

      const response = await api.put(
        `/server/users/${session.userId}/rename-passkey/${passkeyId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: env.AUTH_SERVER_KEY,
          },
          body: JSON.stringify({ name: form.name }),
        }
      );

      return { success: response.ok };
    }
  }

  throw new Response("Not found", { status: 404 });
}
