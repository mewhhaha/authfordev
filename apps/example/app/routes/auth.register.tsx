import { type DataFunctionArgs } from "@remix-run/cloudflare";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { Button } from "~/components/Button";
import { FormItem } from "~/components/FormItem";
import { InputText } from "~/components/InputText";

export async function loader({ context: { env } }: DataFunctionArgs) {
  return {
    clientArgs: {
      apiKey: env.PASSWORDLESS_PUBLIC_KEY,
      apiUrl: env.PASSWORDLESS_API_URL,
    },
  };
}

type ActionDataRequestCode = {
  success: boolean;
  slip?: string;
  reason?: "user taken" | "user missing" | "too many attempts";
  username?: string;
};

export default function SignIn() {
  const actionData = useActionData<ActionDataRequestCode>();
  const navigation = useNavigation();

  return (
    <main>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Register a new user or device
          </h2>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <Form
            method="POST"
            action="/auth/api?act=new-user"
            className="flex flex-col gap-4"
          >
            <input name="q" type="hidden" defaultValue="new-user" />
            <FormItem
              error={actionData?.success === false && actionData.reason}
            >
              <InputText
                name="username"
                readOnly={navigation.state !== "idle"}
                placeholder="user@example.com"
                required
              />
            </FormItem>
            <div className="flex items-center gap-4">
              <Button
                primary
                loading={
                  navigation.state !== "idle" &&
                  navigation.formAction?.includes("new-user")
                }
                className="flex-1"
              >
                New user
              </Button>
              <div>or</div>
              <Button
                secondary
                loading={
                  navigation.state !== "idle" &&
                  navigation.formAction?.includes("new-device")
                }
                formAction="/auth/api?act=new-device"
                formMethod="POST"
              >
                New device
              </Button>
            </div>
          </Form>
          <Link
            className="mt-10 block text-sm font-medium text-indigo-600 hover:underline"
            to="/auth/sign-in"
          >
            Back to sign-in
          </Link>
        </div>
      </div>
    </main>
  );
}
