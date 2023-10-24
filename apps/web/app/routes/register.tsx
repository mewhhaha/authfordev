import type { DataFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import type { ComponentProps, JSXElementConstructor } from "react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "~/css/cn";
import { type } from "arktype";
import { encodeHeader } from "@internal/keys";
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

export async function loader() {
  return { defaultName: generate(3).join("-") };
}

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

    return { status: 200, serverKey, clientKey, slug: data.slug } as const;
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
  const { defaultName } = useLoaderData<typeof loader>();
  const [suggestion] = useState(defaultName);
  const result = useActionData<typeof action>();

  return (
    <main className="mx-auto w-full max-w-2xl pt-10">
      <h1 className="mb-10 text-center text-4xl">
        authfor.dev<Blink interval={500}>|</Blink>
      </h1>
      <Dialog>
        <Form method="POST" className="space-y-10">
          <section>
            <h2 className="text-base font-semibold leading-7 text-gray-900 ">
              Step 1/2
            </h2>
            <p className="mb-2 mt-1 text-sm leading-6 text-gray-600">
              Pick a memorable name for your application.
            </p>
            <div>
              <div className="mb-4 flex flex-col-reverse">
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
                  className="peer"
                  {...form.slug}
                />
                <label
                  id="one-time-code"
                  className="text-sm font-semibold transition-opacity peer-focus:text-amber-800/70"
                >
                  Slug name
                </label>
              </div>
              <Button
                primary={result?.status !== 200}
                secondary={result?.status === 200}
                type="submit"
                className="w-full"
              >
                Submit
              </Button>
              <p className="mt-2 text-sm text-red-600" id="slug-error">
                {result?.status === 422 && "Not a valid name."}
                {result?.status === 409 && "Name is already taken."}
              </p>
            </div>
          </section>
          {result?.status === 200 && (
            <section>
              <h2 className="text-base font-semibold leading-7 text-gray-900 ">
                Step 2/2
              </h2>
              <p className="mb-2 mt-1 text-sm leading-6 text-gray-600">
                Save this file containing your <strong>AUTH_SERVER_KEY</strong>{" "}
                and <strong>AUTH_CLIENT_KEY</strong>.{" "}
                <span className="text-red-600">
                  You can't recover them if you lose them.
                </span>
              </p>
              <ButtonDownload
                content={`AUTH_SERVER_KEY=${result.serverKey}\nAUTH_CLIENT_KEY=${result.clientKey}`}
                filename={`${result.slug}.txt`}
                primary
              >
                Download file with keys
              </ButtonDownload>
            </section>
          )}
        </Form>
      </Dialog>
    </main>
  );
}

type ButtonDownloadProps = {
  content: string;
  filename: string;
  children: React.ReactNode;
} & ButtonProps<"a">;

const ButtonDownload = ({
  content,
  filename,
  children,
  ...props
}: ButtonDownloadProps) => {
  const ref = useRef<HTMLAnchorElement>(null);
  const fileUrl = useMemo(() => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    return url;
  }, [content]);
  return (
    <Button
      ref={ref}
      as="a"
      href={fileUrl}
      download={filename}
      icon={<DownloadIcon />}
      {...props}
    >
      {children}
    </Button>
  );
};

const DownloadIcon = () => {
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
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
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

type ButtonProps<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button",
> = {
  as?: T;
  icon?: React.ReactNode;
  loading?: boolean;
} & (
  | { primary: boolean; secondary?: boolean }
  | { primary?: boolean; secondary: boolean }
) &
  (T extends keyof JSX.IntrinsicElements
    ? JSX.IntrinsicElements[T]
    : ComponentProps<T>);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      icon,
      primary,
      as: Component = "button",
      secondary,
      loading,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Component
        ref={ref}
        {...props}
        aria-disabled={loading}
        onClick={loading ? undefined : props.onClick}
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
        <div className="flex items-center gap-1">
          {icon && <div>{icon}</div>}
          {children}
          {loading && <div className="animate-pulse">...</div>}
        </div>
      </Component>
    );
  }
) as (<
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any> = "button",
>(
  props: ButtonProps<T>
) => JSX.Element) & { displayName?: string };

Button.displayName = "Button";

/** Dialog component  */
const Dialog = forwardRef<HTMLDialogElement, JSX.IntrinsicElements["dialog"]>(
  (props, ref) => {
    return (
      <dialog
        ref={ref}
        open
        {...props}
        className={cn(
          "relative mx-auto my-10 w-full max-w-sm bg-white sm:border sm:px-4 sm:py-10 sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
          props.className
        )}
      />
    );
  }
);

Dialog.displayName = "Dialog";

/** Input Text component */

const InputText = (props: JSX.IntrinsicElements["input"]) => {
  return (
    <input
      {...props}
      className={cn(
        "block w-full rounded-md border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] placeholder:font-bold focus:border-2 focus:border-black",
        "transition-[transform,box-shadow] focus-visible:translate-x-[4px] focus-visible:translate-y-[4px] focus-visible:shadow-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
        props.className
      )}
    />
  );
};
