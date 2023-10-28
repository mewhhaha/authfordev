import { createCookieSessionStorage } from "@remix-run/cloudflare";
import { createSimpleCookieSessionStorage } from "@mewhhaha/little-worker";

export const cookieStorage = createSimpleCookieSessionStorage(
  createCookieSessionStorage
);

export const authenticate = cookieStorage.authenticate;
