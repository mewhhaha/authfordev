import type { DataFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { webauthn } from "~/api/authfordev";
import { authenticate } from "~/auth/authenticate.server";
import { invariant } from "~/auth/invariant";
import { ButtonInline } from "~/components/ButtonInline";

enum Intent {
  Rename = "rename",
  Remove = "remove",
}

export async function loader({
  request,
  params: { passkeyId },
  context: { env },
}: DataFunctionArgs) {
  const session = await authenticate(request, env.SECRET_FOR_AUTH);
  if (!session) {
    throw redirect("/auth");
  }
  invariant(passkeyId, "passkeyId is part of params");

  const response = await webauthn.get(
    `/server/users/${session.userId}/passkeys/${passkeyId}?visitors=true`,
    { headers: { Authorization: env.AUTH_SERVER_KEY } }
  );

  if (!response.ok) {
    throw new Response(null, { status: 404 });
  }

  const { metadata, visitors } = await response.json();
  invariant(visitors, "visitors is included because of query param");

  return { metadata, visitors };
}

export async function action({
  request,
  context: { env },
  params: { passkeyId },
}: DataFunctionArgs) {
  const session = await authenticate(request, env.SECRET_FOR_AUTH);
  if (!session) {
    throw redirect("/auth");
  }
  invariant(passkeyId, "passkeyId is part of params");

  const formData = await request.formData();

  const form = {
    intent: formData.get("intent")?.toString(),
    name: formData.get("name")?.toString(),
  };

  switch (form.intent) {
    case Intent.Remove: {
      const response = await webauthn.delete(
        `/server/users/${session.userId}/passkeys/${passkeyId}`,
        {
          headers: { Authorization: env.AUTH_SERVER_KEY },
        }
      );
      return { success: response.ok };
    }

    case Intent.Rename: {
      if (!form.name) {
        return { success: false, message: "form_data_missing" };
      }

      const response = await webauthn.put(
        `/server/users/${session.userId}/rename-passkey/${passkeyId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: env.AUTH_SERVER_KEY,
          },
          body: JSON.stringify({ name: form.name }),
        }
      );

      return { success: response.ok };
    }
  }

  throw new Response("Not found", { status: 404 });
}

export default function Page() {
  const {
    metadata: { createdAt },
    visitors: [lastVisitor],
  } = useLoaderData<typeof loader>();

  const navigation = useNavigation();

  const loading = (intent: Intent) => {
    return (
      navigation.state === "submitting" &&
      navigation.formData?.get("intent") === intent
    );
  };

  return (
    <div className="bg-amber-50 px-2 pb-8 pt-4">
      <dl className="grid gap-6 sm:grid-cols-2 [&>div]:bg-white [&>div]:px-4 [&>div]:py-2">
        <div>
          <dt className="font-medium">Rename passkey</dt>
          <dd>
            <p className="mb-2 text-sm">
              Rename your passkey to something that's easy to identify.
            </p>
            <Form method="POST">
              <input type="hidden" name="intent" value={Intent.Rename} />
              <input
                type="text"
                minLength={1}
                maxLength={60}
                name="name"
                placeholder="Enter a new name"
                className="mb-1 w-full border-gray-50 text-sm opacity-50 hover:border-black hover:opacity-100 focus:border-black focus:opacity-100"
              />
              <ButtonInline loading={loading(Intent.Rename)}>
                Rename
              </ButtonInline>
            </Form>
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="font-medium">Delete passkey</dt>
          <p className="mb-2 text-sm">
            Permanently delete your passkey so it can't be used for signing in.
          </p>
          <dd className="mt-auto">
            <Form method="POST">
              <input type="hidden" name="intent" value={Intent.Remove} />
              <ButtonInline
                loading={loading(Intent.Remove)}
                className="text-red-600"
              >
                Delete
              </ButtonInline>
            </Form>
          </dd>
        </div>
        <div>
          <dt className="font-medium">Created at</dt>
          <p className="mb-2 text-sm">
            The date when this passkey was created.
          </p>
          <dd>
            <Time dateTime={createdAt} />
          </dd>
        </div>
        <div>
          <dt className="font-medium">Last used at</dt>
          <dd>
            <p className="mb-2 text-sm">
              The date when this passkey was last used at.
            </p>
            <Time dateTime={lastVisitor.timestamp} />
          </dd>
        </div>
        {lastVisitor.country && (
          <div>
            <dt className="font-medium">Last used from</dt>
            <dd>
              <p className="mb-2 text-sm">
                The country this passkey was last used from.
              </p>
              <Region value={lastVisitor.country} />
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

const Time = (props: Omit<JSX.IntrinsicElements["time"], "children">) => {
  const formatter = new Intl.DateTimeFormat("en-se", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: "UTC",
  });

  return (
    <time {...props} className="text-sm font-bold">
      {props.dateTime && formatter.format(new Date(props.dateTime))}
    </time>
  );
};

const Region = (
  props: Omit<JSX.IntrinsicElements["data"], "children" | "value"> & {
    value: string;
  }
) => {
  const formatter = new Intl.DisplayNames("en-se", { type: "region" });

  return <data {...props}>{formatter.of(props.value)}</data>;
};
