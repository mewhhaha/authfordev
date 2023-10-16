import type { SessionData } from "./endpoint.server";
import { createAppCookieSessionStorage } from "./endpoint.server";

export const authenticate = async (
  request: Request,
  secrets: string | string[]
): Promise<SessionData | undefined> => {
  const { getSession } = createAppCookieSessionStorage(secrets);
  const session = await getSession(request.headers.get("Cookie"));
  const id = session.get("id");
  const credentialId = session.get("credentialId");
  if (id === undefined || credentialId === undefined) {
    return undefined;
  }

  return { id, credentialId: credentialId };
};

export const revalidateSession = async (request: Request, secrets: string) => {
  const { getSession, commitSession } = createAppCookieSessionStorage(secrets);
  const session = await getSession(request.headers.get("Cookie"));
  return { "Set-Cookie": await commitSession(session) };
};

export const makeSession = async (
  request: Request,
  secrets: string | string[],
  { id, credentialId }: SessionData
) => {
  const { getSession, commitSession } = createAppCookieSessionStorage(secrets);
  const session = await getSession(request.headers.get("Cookie"));
  session.set("id", id);
  session.set("credentialId", credentialId);
  return {
    "Set-Cookie": await commitSession(session, {
      expires: new Date(Date.now() + 1000 * 60 * 24),
    }),
  };
};

export const removeSession = async (
  request: Request,
  secrets: string | string[]
) => {
  const { getSession, destroySession } = createAppCookieSessionStorage(secrets);
  const session = await getSession(request.headers.get("Cookie"));

  return { "Set-Cookie": await destroySession(session) };
};
