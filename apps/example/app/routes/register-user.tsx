import { redirect, type DataFunctionArgs } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import { authfordev } from "~/api/authfordev";
import { FormItem } from "~/components/FormItem";
import { InputText } from "~/components/InputText";
import { InputOtp } from "~/components/InputOtp";
import { useEffect } from "react";
import { Client } from "@passwordlessdev/passwordless-client";
import { Button } from "~/components/Button";
import { Spin } from "~/components/Spin";

export async function loader({ request, context: { env } }: DataFunctionArgs) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  return {
    email: email ?? "",
    clientArgs: {
      apiKey: env.PASSWORDLESS_PUBLIC_KEY,
      apiUrl: env.PASSWORDLESS_API_URL,
    },
  };
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
      const { slip } = await response.json();
      return { success: true, slip } as const;
    } else if (response.status === 409) {
      return { success: false, reason: "conflict" } as const;
    } else {
      return { success: false, reason: "unknown" } as const;
    }
  };

  const result = await user(env.AUTHFORDEV_AUTHORIZATION, email);
  if (result.success) {
    return { success: true, email, slip: result.slip } as const;
  }
  return { success: false, email, reason: result.reason } as const;
}

export default function Index() {
  const data = useLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

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
              error={
                actionData?.success === false &&
                actionData.reason === "conflict" ? (
                  <>
                    This user already exists. Register a{" "}
                    <Link
                      to={`/register-device?email=${encodeURIComponent(
                        actionData.email
                      )}`}
                      className="font-semibold text-indigo-600 hover:text-indigo-500"
                    >
                      new device?
                    </Link>
                  </>
                ) : undefined
              }
            >
              <InputText
                defaultValue={data.email}
                placeholder="email@example.com"
                autoComplete="webauthn"
                {...form.email}
              />
            </FormItem>

            <div className="flex items-center gap-4">
              {actionData?.success || navigation.state === "submitting" ? (
                <Button
                  secondary
                  className="w-full transition-colors duration-500"
                >
                  Re-send registration code
                </Button>
              ) : (
                <Button
                  primary
                  className="w-full transition-colors duration-500"
                >
                  Send registration code
                </Button>
              )}
            </div>
          </Form>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          {navigation.state === "submitting" && (
            <div className="flex w-full justify-center">
              <Spin />
            </div>
          )}
          {actionData?.success && navigation.state !== "submitting" && (
            <FormVerification
              client={data.clientArgs}
              email={actionData.email}
              slip={actionData.slip}
            />
          )}
        </div>
      </div>
    </main>
  );
}

type FormVerificationProps = {
  slip: string;
  email: string;
  client: { apiUrl: string; apiKey: string };
};

const FormVerification = ({
  slip,
  email,
  client: { apiUrl, apiKey },
}: FormVerificationProps) => {
  const submit = useSubmit();
  const verify = useFetcher<{ success: false; code: string; token?: string }>();

  useEffect(() => {
    const token = verify.data?.token;
    if (!token) return;

    const register = async () => {
      const client = new Client({ apiUrl, apiKey });
      const result = await client.register(token, email);
      if (result.token) {
        submit({ token }, { method: "POST", action: "/sign-in" });
      }
    };

    register();
  }, [apiKey, apiUrl, email, submit, verify.data?.token]);

  return (
    <verify.Form
      key={slip}
      action="/verify-device"
      method="POST"
      className="space-y-6"
      onChange={(event) => {
        const formData = new FormData(event.currentTarget);

        if (
          otp.every((i) => (formData.get(`otp[${i}]`)?.toString() ?? "") !== "")
        ) {
          verify.submit(event.currentTarget);
          event.currentTarget.reset();
        }
      }}
    >
      <input name="slip" type="hidden" defaultValue={slip} />
      <input name="username" type="hidden" defaultValue={email} />
      <FormItem
        label={
          <h2 className="text-center font-semibold">
            Input code sent to {email}
          </h2>
        }
        error={
          verify.data?.success === false
            ? "Code is invalid. Please try inputting the code again."
            : undefined
        }
      >
        <fieldset className="flex justify-between">
          {otp.map((i) => {
            const name = `otp[${i}]`;
            const placeholder =
              verify.formData?.get(name)?.toString() ??
              verify.data?.code[i] ??
              "_";

            return (
              <InputOtp
                key={i}
                autoFocus={i === 0}
                placeholder={placeholder}
                name={name}
                autoComplete={i === 0 ? "one-time-code" : "off"}
              />
            );
          })}
        </fieldset>
      </FormItem>
      <Button primary className="w-full">
        Register
      </Button>
    </verify.Form>
  );
};

const OTP_LENGTH = 6;
const otp = [...new Array(OTP_LENGTH).keys()];
