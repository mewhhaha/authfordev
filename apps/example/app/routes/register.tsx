import { redirect, type DataFunctionArgs } from "@remix-run/cloudflare";

export async function action({ request, context: { env } }: DataFunctionArgs) {
  throw redirect("/sign-in");
}
