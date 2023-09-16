import { createCookieSessionStorage } from "@remix-run/cloudflare";

type Env = {
  SECRET_FOR_AUTH: string;
};

export type SessionData = {
  id: string;
  credentialId: string;
};

export const createAppCookieSessionStorage = (env: Env) => {
  return createCookieSessionStorage<SessionData>({
    cookie: {
      name: "__session",
      httpOnly: true,
      path: "/",

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
  const credentialId = session.get("credentialId");
  if (id === undefined || credentialId === undefined) {
    return undefined;
  }

  return { id, credentialId: credentialId };
};

export const revalidateSession = async (request: Request, context: Env) => {
  const { getSession, commitSession } = createAppCookieSessionStorage(context);
  const session = await getSession(request.headers.get("Cookie"));
  return { "Set-Cookie": await commitSession(session) };
};

export const makeSession = async (
  request: Request,
  env: Env,
  { id, credentialId }: SessionData
) => {
  const { getSession, commitSession } = createAppCookieSessionStorage(env);
  const session = await getSession(request.headers.get("Cookie"));
  session.set("id", id);
  session.set("credentialId", credentialId);
  return {
    "Set-Cookie": await commitSession(session, {
      expires: new Date(Date.now() + 1000 * 60 * 24),
    }),
  };
};

export const removeSession = async (request: Request, env: Env) => {
  const { getSession, destroySession } = createAppCookieSessionStorage(env);
  const session = await getSession(request.headers.get("Cookie"));

  return { "Set-Cookie": await destroySession(session) };
};
