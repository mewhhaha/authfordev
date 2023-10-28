import { fetcher } from "@mewhhaha/little-fetcher";
import type { Routes } from "@mewhhaha/authfor-api";

export const api = fetcher<Routes>("fetch", {
  base: "https://user.authfor.dev",
});
