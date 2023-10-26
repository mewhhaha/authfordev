import { router } from "./routes/_router.js";
export { type Visitor } from "./helpers/parser.js";
export { type Metadata as PasskeyMetadata } from "./passkey.js";
export { DurableObjectUser } from "./user.js";
export { DurableObjectChallenge } from "./challenge.js";
export { DurableObjectPasskey } from "./passkey.js";
export {
  type Metadata as UserMetadata,
  type Recovery as UserRecovery,
} from "./user.js";

const routes = router.infer;
/** @public */
export type Routes = typeof routes;

const handler: ExportedHandler<Env> = {
  fetch: router.all("/*", [], () => new Response("Not found", { status: 404 }))
    .handle,
};

export default handler;
