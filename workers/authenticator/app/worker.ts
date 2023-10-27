import { decode } from "@internal/common";
import { router } from "./routes/_router";
import { type Authenticator } from "./types";

export { type Routes } from "./routes/_router";
export * from "./types";

const handler: ExportedHandler<Env> = {
  fetch: router.all("/*", [], () => new Response("Not found", { status: 404 }))
    .handle,
  scheduled: async (_, env) => {
    const response = await fetch("https://mds3.fidoalliance.org/");
    const jwt = await response.text();

    const [, payload] = jwt.split(".");

    const { entries }: { entries: Authenticator[] } = JSON.parse(
      decode(payload)
    );

    await Promise.all(
      entries.map(async (entry) => {
        await env.KV_AUTHENTICATOR.put(entry.aaguid, JSON.stringify(entry));
      })
    );

    console.log(`Cached ${entries.length} entries`);
  },
};

export default handler;
