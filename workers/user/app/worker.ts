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
  fetch: router.all("/*", [], () => new Response("Not found", { status: 404 }))
    .handle,
};

export default handler;
