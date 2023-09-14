import { createCookieSessionStorage } from "@remix-run/cloudflare";

type Env = {
  SECRET_FOR_AUTH: string;
};

export type SessionData = {
  id: string;
};

export const createAppCookieSessionStorage = (env: Env) => {
  return createCookieSessionStorage<SessionData>({
    cookie: {
      name: "__session",
      httpOnly: true,
      path: "/",
      expires: new Date(Date.now() + 1000 * 60 * 24),
      sameSite: "lax",
      secrets: [env.SECRET_FOR_AUTH],
      secure: true,
    },
  });
};

export const authenticate = async (
  request: Request,
  env: Env
): Promise<SessionData | undefined> => {
  const { getSession } = createAppCookieSessionStorage(env);
  const session = await getSession(request.headers.get("Cookie"));
  const id = session.get("id");
  if (id === undefined) {
    return undefined;
  }

  return { id };
};

export const revalidateSession = async (request: Request, context: Env) => {
  const { getSession, commitSession } = createAppCookieSessionStorage(context);
  const session = await getSession(request.headers.get("Cookie"));
  return { "Set-Cookie": await commitSession(session) };
};

export const makeSession = async (
  request: Request,
  env: Env,
  { id }: SessionData
) => {
  const { getSession, commitSession } = createAppCookieSessionStorage(env);
  const session = await getSession(request.headers.get("Cookie"));
  session.set("id", id);
  return { "Set-Cookie": await commitSession(session) };
};

export const removeSession = async (request: Request, env: Env) => {
  const { getSession, destroySession } = createAppCookieSessionStorage(env);
  const session = await getSession(request.headers.get("Cookie"));

  return { "Set-Cookie": await destroySession(session) };
};
