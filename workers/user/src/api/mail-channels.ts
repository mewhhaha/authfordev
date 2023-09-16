import type { FetchDefinition, Queries } from "@mewhhaha/little-router";
import type { JSONString } from "@mewhhaha/json-string";
import { fetcher } from "@mewhhaha/little-fetcher";
import type { BodyResponse, JSONResponse } from "@mewhhaha/typed-response";

export type BodySend = {
  personalizations: {
    to: { email: string; name: string }[];
    dkim_domain: string;
    dkim_selector: "mailchannels";
    dkim_private_key: string;
  }[];
  from: { email: string; name: string };
  subject: string;
  content: { type: "text/plain" | "text/html"; value: string }[];
};

type RoutesMailChannels = FetchDefinition<
  "post",
  "/send",
  Queries,
  {
    body: JSONString<BodySend>;
    headers: {
      "Content-Type": "application/json";
    };
  },
  | BodyResponse<202>
  | BodyResponse<400>
  | BodyResponse<403>
  | BodyResponse<413>
  | JSONResponse<500, { errors: string[] }>
>;

export const mailChannels = (base: string) =>
  fetcher<RoutesMailChannels>("fetch", { base: base });

export type MailChannels = ReturnType<typeof mailChannels>;
