import { fetcher } from "@mewhhaha/little-fetcher";
import { type Routes } from "@mewhhaha/authfordev-api";

export const authfordev = (apiUrl: string) =>
  fetcher<Routes>("fetch", { base: apiUrl });
