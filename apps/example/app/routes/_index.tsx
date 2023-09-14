import {
  type V2_MetaFunction,
  type DataFunctionArgs,
  redirect,
} from "@remix-run/cloudflare";
import { authenticate } from "~/auth/session";

export const meta: V2_MetaFunction = () => {
  return [
    { title: "Example auth for app" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export async function loader({ request, context: { env } }: DataFunctionArgs) {
  const session = await authenticate(request, env);
  if (!session) {
    throw redirect("/sign-in");
  }

  return { session } as const;
}

export default function Index() {
  return (
    <main>
      <h1>Authenticated</h1>
    </main>
  );
}
