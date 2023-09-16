import { type DataFunctionArgs, redirect } from "@remix-run/cloudflare";
import { authenticate, removeSession } from "~/auth/session";

export async function action({ request, context: { env } }: DataFunctionArgs) {
  const session = await authenticate(request, env);
  if (!session) {
    throw redirect("/sign-in");
  }

  throw redirect("/sign-in", { headers: await removeSession(request, env) });
}
