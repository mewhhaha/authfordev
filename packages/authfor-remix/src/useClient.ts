import { useState } from "react";
import { Client } from "@mewhhaha/authfor-client";

export const useClient = (clientKey: string) => {
  const [client] = useState(() => Client({ clientKey }));
  return client;
};
