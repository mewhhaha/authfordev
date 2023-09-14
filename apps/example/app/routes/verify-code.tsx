import { redirect, type DataFunctionArgs } from "@remix-run/cloudflare";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { authfordev } from "~/api/authfordev";
import { ButtonPrimary } from "~/components/ButtonPrimary";
import { FormItem } from "~/components/FormItem";
import { InputText } from "~/components/InputText";
import { cn } from "~/css/cn";
import type { FocusEvent, KeyboardEvent, FormEvent } from "react";
import { ButtonSecondary } from "~/components/ButtonSecondary";

export async function loader({ request }: DataFunctionArgs) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  return { email: email ?? "" };
}

const form = {
  email: {
    id: "email",
    name: "email",
    type: "email",
    required: true,
  },
};

export async function action({ request, context: { env } }: DataFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  if (!email) {
    throw redirect("/sign-in");
  }

  const user = async (authorization: string, email: string) => {
    const api = authfordev("https://user.authfor.dev");

    const response = await api.post("/new-user", {
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: email, email }),
    });

    if (response.ok) {
      return "email sent";
    } else if (response.status === 409) {
      return "user already exists";
    }

    return "error creating user";
  };

  switch (await user(env.AUTHFOR_AUTHORIZATION, email)) {
    case "email sent":
      return { success: true, email };
    case "error creating user":
    case "user already exists": {
      return { success: false, email };
    }
  }
}

export default function Index() {
  const data = useLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>();

  return (
    <main>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Register a new user
          </h2>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <Form className="space-y-6" method="POST">
            <FormItem
              label={
                <label
                  htmlFor={form.email.id}
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Email address
                </label>
              }
            >
              <InputText
                defaultValue={data.email}
                autoComplete="webauthn"
                {...form.email}
              />
            </FormItem>

            <div className="flex items-center gap-4">
              {actionData?.success ? (
                <ButtonSecondary>Re-send registration code</ButtonSecondary>
              ) : (
                <ButtonPrimary>Send registration code</ButtonPrimary>
              )}
            </div>
          </Form>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <Form>
            <fieldset className="flex justify-between">
              {[...new Array(OTP_LENGTH).keys()].map((i) => {
                return (
                  <InputOTP
                    key={i}
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                  />
                );
              })}
            </fieldset>
            <div className="flex items-center gap-4">
              <ButtonPrimary>Register</ButtonPrimary>
            </div>
          </Form>

          {actionData?.success && (
            <>
              <p>input code sent to {actionData?.email}</p>
              <input
                type="text"
                name="code"
                autoComplete="one-time-code"
                pattern="^[0-9]*$"
                maxLength={6}
                inputMode="numeric"
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

const OTP_LENGTH = 6;

const InputOTP = (props: JSX.IntrinsicElements["input"]) => {
  const handleInput = (event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const value = input.value.replace(/[^0-9]/g, "");

    input.value = value[0] || "";

    let current: HTMLInputElement | null =
      input.nextElementSibling as HTMLInputElement;

    for (const v of value.slice(1)) {
      if (!current) break;
      current.value = v;
      current = current.nextElementSibling as HTMLInputElement;
    }

    (current || input).focus();
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.setSelectionRange(0, 1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const current = event.currentTarget;
    const previous = event.currentTarget
      .previousElementSibling as HTMLInputElement | null;
    if (
      event.key === "Backspace" &&
      current.selectionStart === 0 &&
      current.selectionEnd === 0 &&
      previous
    ) {
      previous.value = "";
      previous.focus();
    }
  };
  return (
    <input
      type="text"
      name="code"
      onInput={handleInput}
      placeholder="_"
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      required
      pattern="^[0-9]$"
      inputMode="numeric"
      {...props}
      className={cn(
        "block w-12 rounded-md border-0 py-1.5 text-center text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xl sm:leading-6",
        props.className
      )}
    />
  );
};
