import { useState } from "react";
import { Client } from "@mewhhaha/little-worker";

export const useClient = (clientKey: string) => {
  const [client] = useState(() => Client({ clientKey }));
  return client;
};
