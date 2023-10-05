import type { Routes } from "@mewhhaha/authfordev-api";
import { fetcher } from "@mewhhaha/little-fetcher";

export const authfordev = fetcher<Routes>("fetch", {
  base: "https://user.authfor.dev",
});
