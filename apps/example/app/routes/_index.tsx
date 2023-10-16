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
import { useSignOut } from "~/auth/useWebAuthn";
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

  const credentials = async () => {
    const response = await authfordev.post("/server/list-credentials", {
      headers: {
        "Content-Type": "application/json",
        Authorization: env.AUTH_SERVER_KEY,
      },
      body: JSON.stringify({ userId: session.id }),
    });

    if (!response.ok) {
      return [];
    }

    const { credentials } = await response.json();
    return credentials;
  };

  return defer({
    language,
    session,
    credentials: await credentials(),
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

  const response = await authfordev.post("/server/delete-credential", {
    headers: {
      "Content-Type": "application/json",
      Authorization: env.AUTH_SERVER_KEY,
    },
    body: JSON.stringify({ credentialId: id, userId: session.id }),
  });

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
  const { language, credentials, session } = useLoaderData<typeof loader>();

  const signout = useSignOut();
  const item = useFetcher<typeof action>();

  return (
    <Context.Provider value={language}>
      <header>
        <div className="border-b p-10 md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Authenticated
            </h2>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <Form action="/auth" onSubmit={signout.submit} method="POST">
              <Button primary>Sign out</Button>
            </Form>
          </div>
        </div>
      </header>
      <main>
        <ul className="grid grid-cols-1 gap-4 p-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {credentials.map(({ credential, createdAt, lastUsedAt, country }) => {
            const isCurrentCredential = session.credentialId === credential.id;
            const isDeletingCredential =
              item.formData?.get("id") === credential.id;
            const isDeleteCredentialFailure = item.data?.id === credential.id;

            return (
              <li
                key={credential.id}
                className={cn("text-ellipsis rounded-lg bg-white p-6 shadow", {
                  "opacity-50": isDeletingCredential,
                  "ring-1 ring-blue-600": isCurrentCredential,
                  "ring-1 ring-red-300": isDeleteCredentialFailure,
                })}
              >
                <h3
                  className="mb-4 truncate text-lg font-medium leading-6 text-gray-900"
                  title={credential.id}
                >
                  {isCurrentCredential && (
                    <span className="text-base text-gray-700">(You) </span>
                  )}
                  {credential.id}
                </h3>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm">Last used at</dt>
                    <dd>
                      <Time dateTime={lastUsedAt} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm">Created at</dt>
                    <dd>
                      <Time dateTime={createdAt} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm">Country</dt>
                    <dd>
                      <Region value={country} />
                    </dd>
                  </div>
                </dl>

                <div className="pt-4">
                  <item.Form method="POST">
                    <input type="hidden" name="id" value={credential.id} />
                    <Button secondary disabled={item.state === "submitting"}>
                      Delete
                    </Button>
                  </item.Form>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </Context.Provider>
  );
}

const Time = (props: Omit<JSX.IntrinsicElements["time"], "children">) => {
  const language = useLanguage();

  return (
    <time {...props}>
      {props.dateTime && new Date(props.dateTime).toLocaleDateString(language)}
    </time>
  );
};

const Region = (
  props: Omit<JSX.IntrinsicElements["data"], "children" | "value"> & {
    value: string;
  }
) => {
  const language = useLanguage();

  const formatter = new Intl.DisplayNames(language, { type: "region" });

  return <data {...props}>{formatter.of(props.value)}</data>;
};

type ButtonProps<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button"
> = {
  as?: T;
  icon?: React.ReactNode;
} & (
  | { primary: boolean; secondary?: boolean }
  | { primary?: boolean; secondary: boolean }
) &
  (T extends keyof JSX.IntrinsicElements
    ? JSX.IntrinsicElements[T]
    : ComponentProps<T>);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { icon, primary, as: Component = "button", secondary, children, ...props },
    ref
  ) => {
    return (
      <Component
        ref={ref}
        {...props}
        onClick={props.onClick}
        className={cn(
          {
            "bg-amber-400 hover:bg-amber-500 focus-visible:bg-amber-500":
              primary,
            "bg-white hover:bg-gray-100 focus-visible:bg-gray-100": secondary,
          },
          "my-2 flex items-center justify-center rounded-lg border-2 border-black px-3 py-1.5 text-sm font-bold leading-6 text-gray-900",
          "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-[transform,box-shadow]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          "focus-visible:translate-x-[2px] focus-visible:translate-y-[2px] focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          "active:translate-x-[3px] active:translate-y-[3px] active:bg-black active:text-white active:shadow-none",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
          "disabled:bg-gray-100 disabled:text-black disabled:hover:bg-gray-100",
          props.className
        )}
      >
        <div className="flex items-center">
          {icon}
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

Button.displayName = "Button";
