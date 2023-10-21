import {
  type MetaFunction,
  type DataFunctionArgs,
  redirect,
} from "@remix-run/cloudflare";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { webauthn } from "~/api/authfordev";
import { authenticate } from "~/auth/authenticate.server";
import { invariant } from "~/auth/invariant";
import { useAddPasskey } from "~/auth/useAddPasskey";
import { useSignOut } from "~/auth/useWebauthn";
import { Button } from "~/components/Button";
import { ButtonInline } from "~/components/ButtonInline";
import { cn } from "~/css/cn";
import { PasskeyIntent } from "./passkeys.$passkeyId";
import type { Visitor } from "@mewhhaha/authfordev-api";

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
      const response = await webauthn.post(
        `/server/users/${session.userId}/passkeys`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: env.AUTH_SERVER_KEY,
          },
          body: JSON.stringify({
            token: form.token,
            origin: env.ORIGIN,
          }),
        }
      );

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

export default function Page() {
  const { passkeys, user, session, clientKey } = useLoaderData<typeof loader>();

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
          <ButtonInline className="w-full max-w-sm" icon={<PlusCircle />}>
            Add a new email
          </ButtonInline>
        </section>
        <section>
          <h2 className="mb-2 text-2xl font-bold">Passkeys</h2>
          <p className="mb-4">Your passkeys that are used to sign in with.</p>
          <ul className="mb-4 flex flex-col gap-4">
            {passkeys.map(({ passkeyId, name }) => {
              const current = session.passkeyId === passkeyId;

              return (
                <li key={passkeyId} className="w-full">
                  <DetailsPasskey current={current}>
                    <summary
                      title={name}
                      className="select-none truncate px-6 py-2 text-lg font-medium leading-6 text-gray-900 hover:cursor-pointer hover:bg-amber-100 group-open:bg-amber-400"
                    >
                      <span className="select-all">{name}</span>
                      {current && (
                        <span className="text-base text-gray-700">
                          {" "}
                          (Session)
                        </span>
                      )}
                    </summary>
                    <Passkey passkeyId={passkeyId} current={current} />
                  </DetailsPasskey>
                </li>
              );
            })}
          </ul>
          <Form onSubmit={addPasskey.submit} method="POST">
            <input
              type="hidden"
              name="username"
              defaultValue={user.metadata.aliases[0]}
            />
            <ButtonInline className="w-full max-w-sm" icon={<PlusCircle />}>
              Add a new passkey
            </ButtonInline>
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
        "group text-ellipsis bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ring-1 ring-inset ring-gray-200",
        { "ring-amber-600": current },
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

const usePasskeyLoader = () => {
  return useFetcher<
    | { success: false }
    | {
        success: true;
        metadata: { createdAt: string };
        visitors: Visitor[];
      }
  >();
};

const usePassKeyAction = () => {
  return useFetcher<{ success: boolean; message?: string }>();
};

type PasskeyProps = {
  passkeyId: string;
  current?: boolean;
};

const Passkey = ({ passkeyId, current }: PasskeyProps) => {
  const loader = usePasskeyLoader();
  const action = usePassKeyAction();

  const ref = useRef<HTMLDivElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    const submit = loader.submit;
    if (!ref.current) return;

    const callback: IntersectionObserverCallback = ([entry]) => {
      if (entry.intersectionRatio > 0) {
        if (submitted.current) return;
        submit(null, { action: `/passkeys/${passkeyId}` });
        submitted.current = true;
      }
    };

    const observer = new IntersectionObserver(callback);
    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [loader.data, loader.state, loader.submit, passkeyId]);

  const loading = (intent: PasskeyIntent) => {
    return (
      action.state === "submitting" && action.formData?.get("intent") === intent
    );
  };

  if (!loader.data || loader.data.success === false) {
    return (
      <div ref={ref} className="flex animate-pulse justify-center py-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-6 w-6 animate-spin"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
      </div>
    );
  }

  const {
    metadata: { createdAt },
    visitors: [lastVisitor],
  } = loader.data;

  return (
    <div className="bg-amber-50 px-2 pb-8 pt-4">
      <dl className="grid gap-6 sm:grid-cols-2 [&>div]:bg-white [&>div]:px-4 [&>div]:py-2">
        <div>
          <dt className="font-medium">Rename passkey</dt>
          <dd>
            <p className="mb-2 text-sm">
              Rename your passkey to something that's easy to identify.
            </p>
            <action.Form action={`/passkeys/${passkeyId}`} method="POST">
              <input type="hidden" name="intent" value={PasskeyIntent.Rename} />
              <input
                type="text"
                minLength={1}
                maxLength={60}
                name="name"
                placeholder="Enter a new name"
                className="mb-1 w-full border-gray-50 text-sm opacity-50 hover:border-black hover:opacity-100 focus:border-black focus:opacity-100"
              />
              <ButtonInline
                className="w-full"
                loading={loading(PasskeyIntent.Rename)}
              >
                Rename
              </ButtonInline>
            </action.Form>
          </dd>
        </div>
        {!current && (
          <div className="flex flex-col">
            <dt className="font-medium">Delete passkey</dt>
            <p className="mb-2 text-sm">
              Permanently delete the passkey so it can't be used for signing in.
            </p>
            <dd className="mt-auto">
              <action.Form action={`/passkeys/${passkeyId}`} method="POST">
                <input
                  type="hidden"
                  name="intent"
                  value={PasskeyIntent.Remove}
                />
                <ButtonInline
                  loading={loading(PasskeyIntent.Remove)}
                  className="w-full text-red-600"
                >
                  Delete
                </ButtonInline>
              </action.Form>
            </dd>
          </div>
        )}

        <div>
          <dt className="font-medium">Created at</dt>
          <p className="mb-2 text-sm">
            The date when this passkey was created.
          </p>
          <dd>
            <Time dateTime={createdAt} />
          </dd>
        </div>
        <div>
          <dt className="font-medium">Last used at</dt>
          <dd>
            <p className="mb-2 text-sm">
              The date when this passkey was last used at.
            </p>
            <Time dateTime={lastVisitor.timestamp} />
          </dd>
        </div>
        {lastVisitor.country && (
          <div>
            <dt className="font-medium">Last used from</dt>
            <dd>
              <p className="mb-2 text-sm">
                The country this passkey was last used from.
              </p>
              <Region value={lastVisitor.country} />
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
};

const Time = (props: Omit<JSX.IntrinsicElements["time"], "children">) => {
  const formatter = new Intl.DateTimeFormat("en-se", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: "UTC",
  });

  return (
    <time {...props} className="text-sm font-bold">
      {props.dateTime && formatter.format(new Date(props.dateTime))}
    </time>
  );
};

const Region = (
  props: Omit<JSX.IntrinsicElements["data"], "children" | "value"> & {
    value: string;
  }
) => {
  const formatter = new Intl.DisplayNames("en-se", { type: "region" });

  return <data {...props}>{formatter.of(props.value)}</data>;
};
