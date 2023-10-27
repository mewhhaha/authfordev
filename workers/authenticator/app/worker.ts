import { decode } from "@internal/common";
import { router } from "./routes/_router";
import { type FIDO2Authenticator } from "./types";

export { type Routes } from "./routes/_router";
export { type Authenticator, type AuthenticatorMetadata } from "./types";

const handler: ExportedHandler<Env> = {
  fetch: router.all("/*", [], () => new Response("Not found", { status: 404 }))
    .handle,
  scheduled: async (_, env) => {
    const fetchFromRepo = async () => {
      const response = await fetch(
        "https://raw.githubusercontent.com/passkeydeveloper/passkey-authenticator-aaguids/main/aaguid.json"
      );
      const entries =
        await response.json<
          Record<
            string,
            { name: string; icon_light: string; icon_dark: string }
          >
        >();

      const promises = Object.entries(entries).map(
        // eslint-disable-next-line @typescript-eslint/naming-convention
        async ([aaguid, { name, icon_light, icon_dark }]) => {
          const metadata = {
            aaguid,
            name,
          };
          const data = {
            ...metadata,
            icon: {
              light: icon_light,
              dark: icon_dark,
            },
          };

          await env.KV_AUTHENTICATOR.put(aaguid, JSON.stringify(data), {
            metadata,
          });
        }
      );

      await Promise.all(promises);
    };

    const fetchFromFido = async () => {
      const response = await fetch("https://mds3.fidoalliance.org/");
      const jwt = await response.text();

      const [, payload] = jwt.split(".");

      const { entries }: { entries: FIDO2Authenticator[] } = JSON.parse(
        decode(payload)
      );

      await Promise.all(
        entries
          .filter((entry) => entry.aaguid)
          .map(async (entry) => {
            const name = entry.metadataStatement.description;
            const icon = entry.metadataStatement.icon;
            const metadata = {
              aaguid: entry.aaguid,
              name,
            };
            const data = {
              ...metadata,
              icon: {
                light: icon,
                dark: icon,
              },
            };
            await env.KV_AUTHENTICATOR.put(entry.aaguid, JSON.stringify(data), {
              metadata,
            });
          })
      );
    };

    await fetchFromRepo();
    await fetchFromFido();
  },
};

export default handler;
