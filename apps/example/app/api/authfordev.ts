import { fetcher } from "@mewhhaha/little-fetcher";
import type { Routes } from "@mewhhaha/authfordev-api";

export const authfordev = fetcher<Routes>("fetch", {
  base: "https://user.authfor.dev",
});
