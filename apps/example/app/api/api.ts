import { fetcher } from "@mewhhaha/little-worker";
import type { Routes } from "@mewhhaha/little-worker";

export const api = fetcher<Routes>("fetch", {
  base: "https://user.authfor.dev",
});
