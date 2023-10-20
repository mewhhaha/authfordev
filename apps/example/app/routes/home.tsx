import {
  type MetaFunction,
  type DataFunctionArgs,
  redirect,
  defer,
} from "@remix-run/cloudflare";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import type { ComponentProps, JSXElementConstructor } from "react";
import { createContext, forwardRef, useContext } from "react";
import { authfordev } from "~/api/authfordev";
import { authenticate } from "~/auth/authenticate.server";
import { useSignOut } from "~/auth/useAuth";
import { cn } from "~/css/cn";

export const meta: MetaFunction = () => {
  return [
    { title: "Example auth for app" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export async function loader({ request, context: { env } }: DataFunctionArgs) {
  const session = await authenticate(request, env.SECRET_FOR_AUTH);
  if (!session) {
    throw redirect("/auth");
  }

  const language = request.headers
    .get("Accept-Language")
    ?.split(";")[0]
    .split(",") || ["en-US"];

  const passkeys = async () => {
    const response = await authfordev.get(
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
    const response = await authfordev.get(
      `/server/users/${session.userId}?recovery=true`,
      { headers: { Authorization: env.AUTH_SERVER_KEY } }
    );
    if (!response.ok) {
      throw redirect("/auth");
    }

    const { metadata, recovery } = await response.json();

    // recovery won't be undefined because we passed recovery=true in the query
    return { metadata, recovery: recovery as NonNullable<typeof recovery> };
  };

  const [u, pks] = await Promise.all([user(), passkeys()]);

  return defer({
    language,
    session,
    user: u,
    passkeys: pks,
  } as const);
}

export async function action({ request, context: { env } }: DataFunctionArgs) {
  const session = await authenticate(request, env.SECRET_FOR_AUTH);
  if (!session) {
    throw redirect("/auth");
  }

  const formData = await request.formData();
  const id = formData.get("id")?.toString();
  if (!id) {
    return { success: false, id: "" };
  }

  const response = await authfordev.delete(
    `/server/users/${session.userId}/passkeys/${id}`,
    { headers: { Authorization: env.AUTH_SERVER_KEY } }
  );

  if (!response.ok) {
    return { success: false, id };
  }

  return { success: true, id: "" };
}

const Context = createContext<string[]>(["en-US"]);

const useLanguage = () => {
  return useContext(Context);
};

export default function Index() {
  const { language, passkeys, user, session } = useLoaderData<typeof loader>();

  const signout = useSignOut();
  const item = useFetcher<typeof action>();

  return (
    <Context.Provider value={language}>
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
          <Button kind="tertiary" inline icon={<PlusCircle />}>
            Add a new email
          </Button>
        </section>
        <section>
          <h2 className="mb-2 text-2xl font-bold">Passkeys</h2>
          <p className="mb-4">Your passkeys that are used to sign in with.</p>
          <ul className="mb-4 flex flex-col gap-4">
            {passkeys.map(({ passkeyId, name, createdAt, lastUsedAt }) => {
              const submittingId = item.formData?.get("id");
              const current = session.passkeyId === passkeyId;
              const submitting =
                submittingId === passkeyId ? "submitting" : false;
              const error = item.data?.id === passkeyId ? "error" : false;

              return (
                <li key={passkeyId} className="max-w-sm">
                  <DetailsPasskey
                    state={submitting || error || "idle"}
                    current={current}
                    summary={
                      name.length > 24
                        ? name.slice(0, 11) + "…" + name.slice(-3)
                        : name
                    }
                  >
                    <div className="px-6 pb-8 pt-4">
                      <dl className="flex flex-col gap-6">
                        <div>
                          <dt className="font-medium">Rename passkey</dt>
                          <dd>
                            <p className="text-sm">
                              Rename your passkey to something that's easy to
                              identify.
                            </p>
                            <item.Form method="POST">
                              <input
                                type="hidden"
                                name="id"
                                value={passkeyId}
                              />
                              <Button
                                kind="tertiary"
                                disabled={item.state === "submitting"}
                                inline
                              >
                                Rename
                              </Button>
                            </item.Form>
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium">Delete passkey</dt>
                          <p className="text-sm">
                            Permanently delete your passkey so it can't be used
                            for signing in.
                          </p>
                          <dd>
                            <item.Form method="POST">
                              <input
                                type="hidden"
                                name="id"
                                value={passkeyId}
                              />
                              <Button
                                kind="tertiary"
                                disabled={item.state === "submitting"}
                                inline
                                className="text-red-600"
                              >
                                Delete
                              </Button>
                            </item.Form>
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium">Last used at</dt>
                          <dd>
                            <p className="text-sm">
                              The date when this passkey was last used
                            </p>
                            <Time dateTime={lastUsedAt} />
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium">Created at</dt>
                          <p className="text-sm">
                            The date when this passkey was created
                          </p>
                          <dd>
                            <Time dateTime={createdAt} />
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </DetailsPasskey>
                </li>
              );
            })}
          </ul>
          <Button kind="tertiary" inline icon={<PlusCircle />}>
            Add a new passkey
          </Button>
        </section>
      </main>
    </Context.Provider>
  );
}

type DetailsPasskeyProps = {
  state: "idle" | "submitting" | "error";
  current?: boolean;
  summary: React.ReactNode;
} & JSX.IntrinsicElements["details"];

const DetailsPasskey = ({
  state,
  current,
  summary,
  children,
  ...props
}: DetailsPasskeyProps) => {
  return (
    <details
      {...props}
      className={cn(
        "group text-ellipsis bg-white shadow",
        {
          "opacity-50": state === "submitting",
          "ring-1 ring-amber-600": current,
          "ring-1 ring-red-300": state === "error",
        },
        props.className
      )}
    >
      <summary className="truncate px-6 py-2 text-lg font-medium leading-6 text-gray-900 hover:cursor-pointer hover:bg-amber-100 group-open:bg-amber-400">
        {current && <span className="text-base text-gray-700">(You) </span>}
        {summary}
      </summary>
      {children}
    </details>
  );
};

const Time = (props: Omit<JSX.IntrinsicElements["time"], "children">) => {
  const language = useLanguage();

  return (
    <time {...props}>
      {props.dateTime &&
        new Date(props.dateTime).toLocaleDateString(language, {
          dateStyle: "full",
        })}
    </time>
  );
};

// const Region = (
//   props: Omit<JSX.IntrinsicElements["data"], "children" | "value"> & {
//     value: string;
//   }
// ) => {
//   const language = useLanguage();

//   const formatter = new Intl.DisplayNames(language, { type: "region" });

//   return <data {...props}>{formatter.of(props.value)}</data>;
// };

type ButtonProps<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button"
> = {
  as?: T;
  icon?: React.ReactNode;
  inline?: boolean;
  kind?: "primary" | "secondary" | "tertiary";
} & (T extends keyof JSX.IntrinsicElements
  ? JSX.IntrinsicElements[T]
  : ComponentProps<T>);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      icon,
      inline = false,
      kind = "primary",
      as: Component = "button",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Component
        ref={ref}
        {...props}
        onClick={props.onClick}
        className={cn(
          "flex items-center justify-center border-2 border-black px-3 py-1.5 text-sm font-bold leading-6 text-gray-900",
          "focus:outline focus:outline-2 focus:outline-offset-2",
          "active:bg-black active:text-white",
          "disabled:bg-gray-100 disabled:text-black disabled:hover:bg-gray-100",
          {
            "bg-amber-400 hover:bg-amber-500 focus:bg-amber-500":
              kind === "primary",
            "bg-white hover:bg-gray-100 focus:bg-gray-100":
              kind === "secondary",
            "bg-white hover:bg-gray-100 border-gray-100 focus:bg-gray-100":
              kind === "tertiary",
          },
          inline
            ? "inline-block translate-x-0 translate-y-0 border-y-0 border-l-8 border-r-0 border-black py-0 shadow-none transition-[border] ease-linear hover:border-x-4 hover:shadow-none focus:border-x-4 active:border-l-0 active:border-r-8"
            : "my-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
          props.className
        )}
      >
        <div className="flex items-center">
          {icon && <div className="mr-2">{icon}</div>}
          {children}
        </div>
      </Component>
    );
  }
) as (<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button"
>(
  props: ButtonProps<T>
) => JSX.Element) & { displayName?: string };

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
