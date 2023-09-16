import {
  type V2_MetaFunction,
  type DataFunctionArgs,
  redirect,
  defer,
} from "@remix-run/cloudflare";
import { Await, Form, useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { authfordev } from "~/api/authfordev";
import { authenticate } from "~/auth/session";
import { Button } from "~/components/Button";
import { cn } from "~/css/cn";

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

  const api = authfordev("https://user.authfor.dev");
  const credentials = async () => {
    const response = await api.post("/list-credentials", {
      headers: {
        "Content-Type": "application/json",
        Authorization: env.AUTHFOR_AUTHORIZATION,
      },
      body: JSON.stringify({ username: session.id }),
    });

    if (!response.ok) {
      return [];
    }

    const { credentials } = await response.json();
    return credentials;
  };

  return defer({ session, credentialsPromise: credentials() } as const);
}

export async function action({ request, context: { env } }: DataFunctionArgs) {
  const session = await authenticate(request, env);
  if (!session) {
    throw redirect("/sign-in");
  }

  const formData = await request.formData();
  const id = formData.get("id")?.toString();
  if (!id) {
    return { success: false, id: "" };
  }

  const api = authfordev("https://user.authfor.dev");
  const response = await api.post("/delete-credential", {
    headers: {
      "Content-Type": "application/json",
      Authorization: env.AUTHFOR_AUTHORIZATION,
    },
    body: JSON.stringify({ credentialId: id }),
  });

  if (!response.ok) {
    return { success: false, id };
  }

  return { success: true, id: "" };
}

export default function Index() {
  const { credentialsPromise, session } = useLoaderData<typeof loader>();

  const item = useFetcher<typeof action>();

  return (
    <>
      <header>
        <div className="border-b p-10 md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Authenticated
            </h2>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <Form action="/sign-out" method="POST">
              <Button primary>Sign out</Button>
            </Form>
          </div>
        </div>
      </header>
      <main>
        <ul className="grid grid-cols-1 gap-4 p-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Await resolve={credentialsPromise}>
            {(credentials) => {
              return credentials.map((c) => {
                const strippedCredentialId = session.credentialId
                  .replace(/\//g, "_")
                  .replace(/=$/, "")
                  .replace(/\+/g, "-");

                const isCurrentCredential =
                  strippedCredentialId === c.descriptor.id;
                const isDeletingCredential =
                  item.formData?.get("id") === c.descriptor.id;
                const isDeleteCredentialFailure =
                  item.data?.id === c.descriptor.id;

                console.log(strippedCredentialId, c.descriptor.id);

                return (
                  <li
                    key={c.descriptor.id}
                    className={cn("rounded-lg bg-white p-6 shadow", {
                      "opacity-50": isDeletingCredential,
                      "ring-1 ring-blue-600": isCurrentCredential,
                      "ring-1 ring-red-300": isDeleteCredentialFailure,
                    })}
                  >
                    <h3 className="text-lg font-medium leading-6 text-gray-900">
                      {isCurrentCredential && (
                        <span className="text-base text-gray-700">(You) </span>
                      )}
                      {c.device}
                    </h3>
                    <dl className="space-y-4">
                      <div>
                        <dt className="text-sm">Last used at</dt>
                        <dd>
                          <Time dateTime={c.lastUsedAt} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm">Created at</dt>
                        <dd>
                          <Time dateTime={c.createdAt} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm">Country</dt>
                        <dd>{c.country}</dd>
                      </div>
                    </dl>

                    <div className="pt-4">
                      <item.Form method="POST">
                        <input
                          type="hidden"
                          name="id"
                          value={c.descriptor.id}
                        ></input>
                        <Button
                          secondary
                          disabled={item.state === "submitting"}
                        >
                          Delete
                        </Button>
                      </item.Form>
                    </div>
                  </li>
                );
              });
            }}
          </Await>
        </ul>
      </main>
    </>
  );
}

const Time = (props: Omit<JSX.IntrinsicElements["time"], "children">) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <time
      dateTime={props.dateTime}
      {...props}
      className={cn(
        "transition-opacity",
        mounted ? "opacity-100" : "opacity-0",
        props.className
      )}
    >
      {mounted
        ? props.dateTime && new Date(props.dateTime).toLocaleDateString()
        : props.dateTime}
    </time>
  );
};
