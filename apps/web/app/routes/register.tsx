import type { DataFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, useActionData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { cn } from "~/css/cn";
import { type } from "arktype";
import { encodeHeader } from "@internal/keys";
import {
  ClipboardIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { generate } from "random-words";

export const meta: MetaFunction = () => {
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

  const parseForm = type(
    {
      slug: `0<string<=50&/${form.slug.pattern}/`,
    },
    { keys: "strict" }
  );

  const { data, problems } = parseForm({
    slug: formData.get(form.slug.name),
  });

  if (problems) {
    return {
      status: 422,
      problems: problems,
    } as const;
  }

  const serverKey = await encodeHeader(
    env.SECRET_FOR_SERVER,
    "server",
    data.slug
  );
  const clientKey = await encodeHeader(
    env.SECRET_FOR_CLIENT,
    "client",
    data.slug
  );

  try {
    await env.D1.prepare(`INSERT INTO app (id, created_at) VALUES (?, ?)`)
      .bind(data.slug, new Date().toISOString())
      .run();

    return { status: 200, serverKey, clientKey } as const;
  } catch {
    return { status: 409 } as const;
  }
}

const form = {
  slug: {
    id: "slug",
    name: "slug",
    required: true,
    type: "text",
    maxLength: 50,
    pattern: "([a-z]+(-[a-z]+)+?)",
  },
} as const;

export default function Page() {
  const result = useActionData<typeof action>();

  const [suggestion] = useState(() => generate(4).join("-"));

  return (
    <main className="mx-auto w-full max-w-2xl pt-10">
      <h1 className="mb-10 text-center text-4xl">
        authfor.dev<Blink interval={500}>|</Blink>
      </h1>
      <div className="rounded-none border border-black p-4 md:rounded-md">
        <Form method="POST" className="space-y-10">
          <section>
            <h2 className="text-base font-semibold leading-7 text-gray-900 ">
              Step 1/2
            </h2>
            <p className="mb-2 mt-1 text-sm leading-6 text-gray-600">
              Pick a memorable name for your application.
            </p>
            <div>
              <div className="mb-4">
                <InputLabel htmlFor={form.slug.id}>
                  Slug name <RequiredMark />
                </InputLabel>
                <InputText
                  autoComplete="off"
                  defaultValue={suggestion}
                  onChange={(event) => {
                    event.currentTarget.value = event.currentTarget.value
                      .toLocaleLowerCase()
                      .replace(/[^a-z]/g, "-");
                  }}
                  aria-invalid={
                    result?.status === 422 || result?.status === 409
                  }
                  aria-describedby="slug-error"
                  {...form.slug}
                />
                <p className="mt-2 text-sm text-red-600" id="slug-error">
                  {result?.status === 422 && "Not a valid name."}
                  {result?.status === 409 && "Name is already taken."}
                </p>
              </div>
              <ButtonPrimary type="submit" className="w-full">
                Submit
              </ButtonPrimary>
            </div>
          </section>
          {result?.status === 200 && (
            <section>
              <h2 className="text-base font-semibold leading-7 text-gray-900 ">
                Step 2/2
              </h2>
              <p className="mb-2 mt-1 text-sm leading-6 text-gray-600">
                Copy-paste the keys to your application and use them as
                authorization headers. You cannot recover them if you lose them.
              </p>
              <div className="flex flex-col gap-4">
                <DescriptionInput label="Server key (secret)" copy>
                  {result.serverKey}
                </DescriptionInput>
                <DescriptionInput label="Client key" copy>
                  {result.clientKey}
                </DescriptionInput>
              </div>
            </section>
          )}
        </Form>
      </div>
    </main>
  );
}

type DescriptionInputProps = {
  label: React.ReactNode;
  children: string;
  type?: "password";
  copy?: boolean;
};

const DescriptionInput = ({
  label,
  type,
  children,
  copy,
}: DescriptionInputProps) => {
  const [visible, setVisible] = useState(type !== "password");

  return (
    <div>
      <dt className="mb-2 block text-sm font-medium leading-6 text-gray-900">
        {label}
      </dt>
      <dd className="flex">
        <div className="relative grow">
          <InputText
            readOnly
            value={children}
            type={type === "password" && !visible ? "password" : "text"}
            className={cn(
              "grow text-ellipsis bg-transparent text-gray-900",
              type === "password" ? "pr-12" : ""
            )}
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
        {copy && <ButtonCopy value={children} />}
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

const InputLabel = (props: JSX.IntrinsicElements["label"]) => {
  return (
    <label
      {...props}
      className={cn(
        "mb-2 block text-sm font-medium leading-6 text-gray-900",
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
        "block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6",
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
