import {
  type V2_MetaFunction,
  type DataFunctionArgs,
  redirect,
} from "@remix-run/cloudflare";
import { Form } from "@remix-run/react";
import { cn } from "~/css/cn";
import { authfordev } from "~/api/authfordev";
import { makeSession } from "~/auth/session";

export const meta: V2_MetaFunction = () => {
  return [
    { title: "Example sign in for app" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export async function action({ request, context: { env } }: DataFunctionArgs) {
  const formData = await request.formData();
  const token = formData.get("token")?.toString();
  if (!token) {
    return { success: false } as const;
  }
  const api = authfordev("https://user.authfor.dev");

  const response = await api.post("/signin", {
    headers: {
      Authorization: env.AUTHFOR_AUTHORIZATION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    return { success: false } as const;
  }

  const data = await response.json();

  const headers = await makeSession(request, env, { id: data.userId });

  throw redirect("/", { headers });
}

export default function Index() {
  return (
    <main>
      <>
        <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-sm">
            <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
              Sign in to your account
            </h2>
          </div>

          <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
            <Form className="space-y-6" method="POST">
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Email address
                  </label>
                </div>
                <div className="mt-2">
                  <input
                    autoComplete="webauthn"
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <ButtonPrimary type="submit">Sign in</ButtonPrimary>
                <ButtonSecondary type="submit" formAction="/register">
                  Register
                </ButtonSecondary>
              </div>
            </Form>
          </div>
        </div>
      </>
    </main>
  );
}

const ButtonPrimary = (props: JSX.IntrinsicElements["button"]) => {
  return (
    <button
      {...props}
      className={cn(
        "flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
        props.className
      )}
    />
  );
};

const ButtonSecondary = (props: JSX.IntrinsicElements["button"]) => {
  return (
    <button
      {...props}
      className={cn(
        "rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
        props.className
      )}
    />
  );
};
