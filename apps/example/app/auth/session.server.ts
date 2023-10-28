import { createCookieSessionStorage } from "@remix-run/cloudflare";
import { createSimpleCookieSessionStorage } from "@mewhhaha/authfor-remix/endpoint.server";

export const cookieStorage = createSimpleCookieSessionStorage(
  createCookieSessionStorage
);

export const authenticate = cookieStorage.authenticate;
