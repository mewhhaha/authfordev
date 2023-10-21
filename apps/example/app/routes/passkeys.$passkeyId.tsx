import type { DataFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { webauthn } from "~/api/authfordev";
import { authenticate } from "~/auth/authenticate.server";
import { invariant } from "~/auth/invariant";

export enum PasskeyIntent {
  Rename = "rename",
  Remove = "remove",
}

export async function loader({
  request,
  params: { passkeyId },
  context: { env },
}: DataFunctionArgs) {
  const session = await authenticate(request, env.SECRET_FOR_AUTH);
  if (!session) {
    throw redirect("/auth");
  }
  invariant(passkeyId, "passkeyId is part of params");

  const response = await webauthn.get(
    `/server/users/${session.userId}/passkeys/${passkeyId}?visitors=true`,
    { headers: { Authorization: env.AUTH_SERVER_KEY } }
  );

  if (!response.ok) {
    return { success: false } as const;
  }

  const { metadata, visitors } = await response.json();
  invariant(visitors, "visitors is included because of query param");

  return { success: true, metadata, visitors };
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
      const response = await webauthn.delete(
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

      const response = await webauthn.put(
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
