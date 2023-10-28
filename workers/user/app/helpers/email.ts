import {
  type BodyResponse,
  type FetchDefinition,
  type JSONResponse,
  type JSONString,
  type Queries,
  fetcher,
} from "@mewhhaha/little-worker";
import emailSendCode from "@internal/emails/dist/send-code.json";

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
  fetcher<RoutesMailChannels>("fetch", { base });

export type MailChannels = ReturnType<typeof mailChannels>;

export const sendEmail = async (apiUrl: string, body: BodySend) => {
  const api = mailChannels(apiUrl);

  const response = await api.post("/send", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error(new Error(await response.text()));
  }
};

export const createBody = ({
  email,
  username,
  code,
  dkim,
}: {
  email: string;
  username: string;
  code: string;
  dkim: Env["DKIM_PRIVATE_KEY"];
}): BodySend => {
  return {
    personalizations: [
      {
        to: [{ email, name: email.split("@")[0] }],
        // https://support.mailchannels.com/hc/en-us/articles/16918954360845-Secure-your-domain-name-against-spoofing-with-Domain-Lockdown-
        // https://support.mailchannels.com/hc/en-us/articles/7122849237389
        dkim_domain: "authfor.dev",
        dkim_selector: "mailchannels",
        dkim_private_key: dkim,
      },
    ],
    from: {
      email: "noreply@authfor.dev",
      name: `authfor.dev support`,
    },
    subject: `New device for ${username}`,
    content: [defaultEmail({ code })],
  };
};

const defaultEmail = ({ code }: { code: string }) =>
  ({
    type: "text/html",
    value: emailSendCode.html.replace("{{123456}}", code),
  }) as const;
