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
      <div className="rounded-none border border-black p-4 md:rounded-md">
        <Form method="POST" className="space-y-10">
          <section>
            <h2 className="text-base font-semibold leading-7 text-gray-900 ">
              Step 1
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Create an account and an application at{" "}
              <LinkExternal href="https://admin.passwordless.dev/">
                https://admin.passwordless.dev/
              </LinkExternal>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold leading-7 text-gray-900 ">
              Step 2
            </h2>
            <p className="mb-2 mt-1 text-sm leading-6 text-gray-600">
              Copy-paste the private api key from your newly created application
            </p>
            <div>
              <div>
                <InputLabel htmlFor={form.pk.id}>
                  Passwordless private API key <RequiredMark />
                </InputLabel>
                <InputText
                  disabled={result?.status === 200}
                  autoComplete="off"
                  placeholder="***"
                  aria-invalid={result?.status === 422}
                  aria-describedby="pk-error"
                  {...form.pk}
                />
                <p className="mt-2 text-sm text-red-600" id="pk-error">
                  {result?.status === 422 && "Not a valid private API key."}
                  {result?.status === 409 && "Unknown error, try again."}
                </p>
              </div>
              <ButtonPrimary type="submit" className="w-full">
                Submit
              </ButtonPrimary>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold leading-7 text-gray-900 ">
              Step 3
            </h2>
            <p className="mb-2 mt-1 text-sm leading-6 text-gray-600">
              Save this authorization header in your application and use it to
              authenticate
            </p>
            <output name="result" htmlFor="pk">
              {result?.status !== 200 && (
                <dl>
                  <DescriptionInput label="Authorization header">
                    Waiting for step 2 to be completed
                  </DescriptionInput>
                </dl>
              )}
              {result?.status === 200 && (
                <dl>
                  <DescriptionInput
                    label="Authorization header"
                    type="password"
                    copy
                  >
                    {result.authorization}
                  </DescriptionInput>
                </dl>
              )}
            </output>
          </section>
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
      <dt className="mb-2 text-sm font-semibold">{label}</dt>
      <dd className="flex">
        <div className="relative grow">
          <InputText
            readOnly
            value={children}
            type={type === "password" && !visible ? "password" : "text"}
            className={
              (cn("grow bg-transparent text-gray-900"),
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
