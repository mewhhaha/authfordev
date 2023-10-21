import { Client } from "@mewhhaha/authfordev-client";
import {
  type MetaFunction,
  type DataFunctionArgs,
  redirect,
} from "@remix-run/cloudflare";
import type { SubmitOptions } from "@remix-run/react";
import {
  Form,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
} from "@remix-run/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { webauthn } from "~/api/authfordev";
import { authenticate } from "~/auth/authenticate.server";
import { invariant } from "~/auth/invariant";
import { useSignOut } from "~/auth/useWebauthn";
import { Button } from "~/components/Button";
import { ButtonInline } from "~/components/ButtonInline";
import { cn } from "~/css/cn";

export const meta: MetaFunction = () => {
  return [
    { title: "Example auth for app" },
    { name: "description", content: "Welcome home!" },
  ];
};

export async function loader({ request, context: { env } }: DataFunctionArgs) {
  const session = await authenticate(request, env.SECRET_FOR_AUTH);
  if (!session) {
    throw redirect("/auth");
  }

  const passkeys = async () => {
    const response = await webauthn.get(
      `/server/users/${session.userId}/passkeys`,
      { headers: { Authorization: env.AUTH_SERVER_KEY } }
    );

    if (!response.ok) {
      return [];
    }

    const { passkeys } = await response.json();
    return passkeys;
  };

  const user = async () => {
    const response = await webauthn.get(
      `/server/users/${session.userId}?recovery=true`,
      { headers: { Authorization: env.AUTH_SERVER_KEY } }
    );
    if (!response.ok) {
      throw redirect("/auth");
    }

    const { metadata, recovery } = await response.json();
    invariant(recovery, "recovery is included because of query param");
    return { metadata, recovery };
  };

  const [u, pks] = await Promise.all([user(), passkeys()]);

  return {
    session,
    user: u,
    passkeys: pks,
    clientKey: env.AUTH_CLIENT_KEY,
  } as const;
}

enum Intent {
  AddPasskey = "add-passkey",
  AddEmail = "add-email",
}

export async function action({ request, context: { env } }: DataFunctionArgs) {
  const session = await authenticate(request, env.SECRET_FOR_AUTH);
  if (!session) {
    throw redirect("/auth");
  }

  const formData = await request.formData();

  const form = {
    intent: formData.get("intent")?.toString(),
    token: formData.get("token")?.toString(),
    email: formData.get("email")?.toString(),
  };

  switch (form.intent) {
    case Intent.AddPasskey: {
      if (!form.token) {
        return { success: false, message: "form_data_missing" };
      }
      const response = await webauthn.post("/server/users/:userId/passkeys", {
        headers: {
          "Content-Type": "application/json",
          Authorization: env.AUTH_SERVER_KEY,
        },
        body: JSON.stringify({ token: form.token, origin: env.ORIGIN }),
      });

      if (!response.ok) {
        return { success: false };
      }

      return { success: true };
    }

    case Intent.AddEmail: {
      return { success: false };
    }
  }

  throw new Response("Not found", { status: 404 });
}

export default function Index() {
  const { passkeys, user, session, clientKey } = useLoaderData<typeof loader>();
  const { passkeyId: selected } = useParams();

  const navigate = useNavigate();
  const signout = useSignOut();

  const addPasskey = useAddPasskey(clientKey);

  return (
    <>
      <header>
        <div className="border-b p-10 md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Authenticated
            </h1>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <Form action="/auth" onSubmit={signout.submit} method="POST">
              <Button kind="secondary">Sign out</Button>
            </Form>
          </div>
        </div>
      </header>
      <main className="flex flex-col gap-10 px-2 py-10 sm:px-10">
        <section>
          <h2 className="mb-2 text-2xl font-bold">Emails</h2>
          <p className="mb-4">Your email used to recover your account with.</p>
          <ul>
            {user.recovery.emails.map(({ address, verified, primary }) => {
              return (
                <li key={address}>
                  <div className="flex flex-row gap-2">
                    <p className="text-sm">{address}</p>
                    {verified ? (
                      <p className="text-sm">Verified</p>
                    ) : (
                      <p className="text-sm">Not Verified</p>
                    )}
                    {primary && <p>Primary</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          <ButtonInline icon={<PlusCircle />}>Add a new email</ButtonInline>
        </section>
        <section>
          <h2 className="mb-2 text-2xl font-bold">Passkeys</h2>
          <p className="mb-4">Your passkeys that are used to sign in with.</p>
          <ul className="mb-4 flex flex-col gap-4">
            {passkeys.map(({ passkeyId, name }) => {
              const current = session.passkeyId === passkeyId;

              return (
                <li key={passkeyId} className="w-full">
                  <DetailsPasskey
                    open={selected === passkeyId}
                    current={current}
                  >
                    <summary
                      onClick={() => {
                        navigate(selected ? "" : `passkeys/${passkeyId}`);
                      }}
                      title={name}
                      className="truncate px-6 py-2 text-lg font-medium leading-6 text-gray-900 hover:cursor-pointer hover:bg-amber-100 group-open:bg-amber-400"
                    >
                      {current && (
                        <span className="text-base text-gray-700">(You) </span>
                      )}
                      {name}
                    </summary>
                    <Outlet />
                  </DetailsPasskey>
                </li>
              );
            })}
          </ul>
          <Form onSubmit={addPasskey.submit} method="POST">
            <ButtonInline icon={<PlusCircle />}>Add a new passkey</ButtonInline>
          </Form>
        </section>
      </main>
    </>
  );
}

type DetailsPasskeyProps = {
  current?: boolean;
} & JSX.IntrinsicElements["details"];

const DetailsPasskey = ({
  current,
  children,
  ...props
}: DetailsPasskeyProps) => {
  return (
    <details
      {...props}
      className={cn(
        "group text-ellipsis bg-white shadow",
        { "ring-1 ring-amber-600": current },
        props.className
      )}
    >
      {children}
    </details>
  );
};

const PlusCircle = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
};

export const useAddPasskey = (clientKey: string) => {
  const [client] = useState(() => Client({ clientKey }));
  const fetcher = useFetcher<{ message: string; status: number }>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    if (fetcher.state !== "idle") {
      console.warn("Tried adding passkey while already adding passkey.");
      return;
    }

    const options = formOptions(event.currentTarget);
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const username = formData.get("username")?.toString();
    if (!username) {
      console.error("username_missing");
      return;
    }

    const { token, reason } = await client.register(username);
    if (reason) {
      console.error(reason);
      return;
    }

    formData.set("intent", Intent.AddPasskey);
    formData.set("token", token);
    fetcher.submit(formData, options);
  };

  return {
    submit,
    state: fetcher.state,
    error: fetcher.data !== undefined,
  };
};

const formOptions = (element: HTMLFormElement) =>
  ({
    method: element.method,
    encType: element.enctype,
    action: element.action.startsWith("http")
      ? new URL(element.action).pathname
      : element.action,
  } as SubmitOptions);
