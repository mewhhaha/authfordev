import { router } from "./routes/_router.js";
export { type Visitor } from "./helpers/parser.js";
export { type Metadata as PasskeyMetadata } from "./objects/passkey.js";
export { DurableObjectUser } from "./objects/user.js";
export { DurableObjectChallenge } from "./objects/challenge.js";
export { DurableObjectPasskey } from "./objects/passkey.js";
export {
  type Metadata as UserMetadata,
  type Recovery as UserRecovery,
} from "./objects/user.js";

const routes = router.infer;
/** @public */
export type Routes = typeof routes;

const handler: ExportedHandler<Env> = {
  fetch: (request, env, ctx) => {
    setJurisdiction(env, "eu");

    return router
      .all("/*", [], () => new Response("Not found", { status: 404 }))
      .handle(request, env, ctx);
  },
};

const setJurisdiction = (env: Env, jurisdiction: DurableObjectJurisdiction) => {
  if (env.ENVIRONMENT === "test") {
    return env;
  }

  for (const key in env) {
    const value = env[key as keyof typeof env];
    if (typeof value === "object" && "jurisdiction" in value) {
      // @ts-expect-error - TS doesn't understand that the above checks guarantee this
      env[key as keyof typeof env] = value.jurisdiction(jurisdiction);
    }
  }

  return env;
};

export default handler;
