import { redirect, type DataFunctionArgs } from "@remix-run/cloudflare";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { authfordev } from "~/api/authfordev";
import { ButtonPrimary } from "~/components/ButtonPrimary";
import { FormItem } from "~/components/FormItem";
import { InputOtp } from "~/components/InputOtp";
import { InputText } from "~/components/InputText";

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

  const device = async (authorization: string, email: string) => {
    const api = authfordev("https://user.authfor.dev");

    const response = await api.post("/new-device", {
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: email }),
    });

    if (response.ok) {
      const { id } = await response.json();
      return { success: true, id };
    } else {
      return { success: false };
    }
  };

  const result = await device(env.AUTHFOR_AUTHORIZATION, email);
  if (result.success) {
    return { success: true, email, id: result.id } as const;
  } else {
    return { success: false, email } as const;
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
            Register a new device
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
              <ButtonPrimary>Send new device code</ButtonPrimary>
            </div>
          </Form>
        </div>
        {actionData && (
          <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
            {actionData?.success && (
              <Form
                key={actionData.id}
                action="/verify-code"
                method="POST"
                className="space-y-6"
              >
                <h2 className="text-center font-semibold">
                  Input code sent to {actionData.email}
                </h2>
                <input name="id" type="hidden" defaultValue={actionData.id} />
                <fieldset className="flex justify-between">
                  {[...new Array(OTP_LENGTH).keys()].map((i) => {
                    return (
                      <InputOtp
                        key={i}
                        name="otp[]"
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                      />
                    );
                  })}
                </fieldset>
                <div className="flex items-center gap-4">
                  <ButtonPrimary>Register</ButtonPrimary>
                </div>
              </Form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

const OTP_LENGTH = 6;
