import type { DataFunctionArgs, V2_MetaFunction } from "@remix-run/cloudflare";
import { Form, useActionData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { cn } from "~/css/cn";
import { type } from "arktype";
import { encodeJwt } from "@internal/jwt";
import {
  ClipboardIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";

export const meta: V2_MetaFunction = () => {
  return [
    { title: "authfor.dev" },
    {
      name: "description",
      content: "Connect with passwordless for your application",
    },
  ];
};

export async function action({ request, context: { env } }: DataFunctionArgs) {
  const formData = await request.formData();

  const parseForm = type({
    pk: `/${form.pk.pattern}/`,
  });

  const { data, problems } = parseForm({
    pk: formData.get(form.pk.name),
  });

  if (problems) {
    return {
      status: 422,
      problems: problems,
    } as const;
  }

  const id = crypto.randomUUID();

  const jwt = await encodeJwt(env.SECRET_FOR_HMAC, { id, pk: data.pk });

  try {
    await env.D1.prepare(`INSERT INTO applications (id) VALUES (?)`)
      .bind(id)
      .run();

    return { status: 200, authorization: `Bearer ${jwt}` } as const;
  } catch {
    return { status: 409 } as const;
  }
}

const form = {
  pk: {
    id: "pk",
    name: "pk",
    required: true,
    type: "password",
    pattern: "^[^:]+:secret:[^:]+$",
  },
} as const;

export default function Page() {
  const result = useActionData<typeof action>();

  return (
    <main className="mx-auto w-full max-w-3xl pt-10">
      <h1 className="mb-10 text-center text-4xl">
        authfor.dev<Blink interval={500}>|</Blink>
      </h1>
      <div className="rounded-none border border-black p-4 dark:border-white/10 md:rounded-md">
        <Form method="post">
          <h2 className="text-base font-semibold leading-7 text-gray-900 dark:text-white">
            Connect passwordless authentication
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
            This requires a passwordless application which you can sign up for
            at{" "}
            <LinkExternal href="https://admin.passwordless.dev/">
              https://admin.passwordless.dev/
            </LinkExternal>
          </p>
          <div className="mt-10 flex flex-col gap-4">
            <div>
              <InputLabel htmlFor={form.pk.id}>
                Passwordless private API key <RequiredMark />
              </InputLabel>
              <InputText
                disabled={result?.status === 200}
                autoComplete="off"
                placeholder="***"
                {...form.pk}
              />
              <InputHelp>
                Copy-paste the private api key from your passwordless
                application
              </InputHelp>
            </div>

            <ButtonPrimary type="submit" className="mx-auto">
              Submit
            </ButtonPrimary>
          </div>
          <output name="result" htmlFor="pk">
            <div
              className={cn(
                "mt-10 rounded-md border p-4 text-gray-900 dark:border-white/5 dark:text-white",
                result === undefined ? "opacity-60" : ""
              )}
            >
              {result === undefined && (
                <p className="text-center">
                  Authorization header will be output here after submitting the
                  form
                </p>
              )}
              {result?.status === 422 && (
                <p className="text-center">Could not parse the form properly</p>
              )}
              {result?.status === 409 && (
                <p className="text-center">
                  There was a conflict for some odd reason, please try again
                  later
                </p>
              )}
              {result?.status === 200 && (
                <dl className="flex flex-col gap-4">
                  <p className="text-center">
                    Save this authorization header securely, and use it to
                    authenticate against the API
                  </p>
                  <Description label="Authorization header" type="password">
                    {result.authorization}
                  </Description>
                </dl>
              )}
            </div>
          </output>
        </Form>
      </div>
    </main>
  );
}

type DescriptionProps = {
  label: React.ReactNode;
  children: string;
  type?: "password";
};

const Description = ({ label, type, children }: DescriptionProps) => {
  const [visible, setVisible] = useState(type !== "password");

  return (
    <div>
      <dt className="mb-2 text-sm font-semibold">{label}</dt>
      <dd className="flex">
        <div className="relative grow">
          <InputText
            readOnly
            value={children}
            type={type === "password" && !visible ? "password" : "text"}
            className={
              (cn("grow bg-transparent text-gray-900 dark:text-white"),
              type === "password" ? "pr-12" : "")
            }
          />
          {type === "password" && (
            <button
              type="button"
              onClick={() => {
                setVisible((p) => !p);
              }}
              className="absolute inset-y-0 right-0 flex w-8 flex-none items-center"
            >
              {visible ? (
                <EyeSlashIcon className="h-6 w-6" />
              ) : (
                <EyeIcon className="h-6 w-6" />
              )}
            </button>
          )}
        </div>
        <ButtonCopy value={children} />
      </dd>
    </div>
  );
};

type ButtonCopyProps = {
  value: string;
} & JSX.IntrinsicElements["button"];

const ButtonCopy = ({ value, ...props }: ButtonCopyProps) => {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setCopied(true);
        navigator.clipboard.writeText(value);
      }}
      {...props}
      className={cn(
        "flex h-8 w-20 items-center justify-center pl-2",
        props.className
      )}
    >
      {copied ? "copied" : <ClipboardIcon className="h-6 w-6" />}
    </button>
  );
};

const LinkExternal = (props: JSX.IntrinsicElements["a"]) => {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      {...props}
      children={props.children}
      className={cn(
        "text-blue-600 underline visited:text-indigo-600 hover:text-blue-500",
        props.className
      )}
    />
  );
};

const InputLabel = (props: JSX.IntrinsicElements["label"]) => {
  return (
    <label
      {...props}
      className={cn(
        "mb-2 block text-sm font-medium leading-6 text-gray-900 dark:text-white",
        props.className
      )}
    />
  );
};

const InputHelp = (props: JSX.IntrinsicElements["p"]) => {
  return (
    <p
      {...props}
      className={cn(
        "mt-2 bg-blue-50 px-2 py-1 text-sm text-gray-600 dark:bg-blue-900 dark:text-gray-100",
        props.className
      )}
    />
  );
};

const InputText = (props: JSX.IntrinsicElements["input"]) => {
  return (
    <input
      {...props}
      className={cn(
        "block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200 dark:bg-white/5 dark:text-white dark:ring-inset dark:ring-white/10 dark:disabled:bg-gray-950 dark:disabled:ring-white/5 sm:text-sm sm:leading-6",
        props.className
      )}
    />
  );
};

const ButtonPrimary = (props: JSX.IntrinsicElements["button"]) => {
  return (
    <button
      {...props}
      className={cn(
        "rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
        props.className
      )}
    />
  );
};

const RequiredMark = () => {
  return (
    <span className="text-red-400" aria-label="required">
      *
    </span>
  );
};

type BlinkProps = {
  interval: number;
} & JSX.IntrinsicElements["span"];

const Blink = ({ interval, ...props }: BlinkProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timeout = setInterval(() => setShow((p) => !p), interval);

    return () => clearInterval(timeout);
  }, [interval]);

  return (
    <span {...props} className={cn(props.className, show ? "" : "invisible")} />
  );
};
