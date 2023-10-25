import type { CreateCookieSessionStorageFunction } from "@remix-run/server-runtime";

export interface SessionData {
  userId: string;
  passkeyId?: string;
}

export const createSimpleCookieSessionStorage = (
  createCookieSesssionStorageFunc: CreateCookieSessionStorageFunction
) => {
  const authenticate = async (
    request: Request,
    secrets: string | string[]
  ): Promise<Required<SessionData> | undefined> => {
    const { getSession } = createAppCookieSessionStorage(secrets);
    const session = await getSession(request.headers.get("Cookie"));

    const record: Partial<SessionData> = session.data;

    for (const [key, value] of Object.entries(session.data)) {
      // Remove flash and credential id
      if (key.startsWith("__") && key.endsWith("__")) {
        record[key as keyof typeof record] = undefined;
      } else if (!value) {
        return undefined;
      }
    }

    if (JSON.stringify(record) === "{}") return undefined;

    return record as Required<SessionData>;
  };

  const revalidate = async (request: Request, secrets: string) => {
    const { getSession, commitSession } =
      createAppCookieSessionStorage(secrets);
    const session = await getSession(request.headers.get("Cookie"));
    return { "Set-Cookie": await commitSession(session) };
  };

  const create = async (
    request: Request,
    secrets: string | string[],
    data: Required<SessionData>,
    {
      expires = new Date(Date.now() + 1000 * 60 * 60 * 24),
    }: { expires?: Date } = {}
  ) => {
    const { getSession, commitSession } =
      createAppCookieSessionStorage(secrets);
    const session = await getSession(request.headers.get("Cookie"));
    for (const [key, value] of Object.entries(data)) {
      session.set(key as keyof SessionData, value);
    }

    return {
      "Set-Cookie": await commitSession(session, {
        expires,
      }),
    };
  };

  const remove = async (request: Request, secrets: string | string[]) => {
    const { getSession, destroySession } =
      createAppCookieSessionStorage(secrets);
    const session = await getSession(request.headers.get("Cookie"));

    return { "Set-Cookie": await destroySession(session) };
  };

  const createAppCookieSessionStorage = (secrets: string | string[]) => {
    return createCookieSesssionStorageFunc<SessionData>({
      cookie: {
        name: "__session",
        httpOnly: true,
        path: "/",

        sameSite: "lax",
        secrets: typeof secrets === "string" ? [secrets] : secrets,
        secure: true,
      },
    });
  };

  return {
    remove,
    authenticate,
    revalidate,
    create,
  };
};
