import { route, err, ok } from "@mewhhaha/little-worker";
import { $passkey, type GuardPasskey, guardPasskey } from "../passkey.js";
import { server_ } from "../plugins/server.js";
import { $user, type GuardUser, guardUser } from "../user.js";

export default route(
  PATTERN,
  [server_],
  async ({ app, params: { userId, passkeyId } }, env) => {
    const jurisdiction = {
      passkey: env.DO_PASSKEY.jurisdiction("eu"),
      user: env.DO_USER.jurisdiction("eu"),
    };

    const user = $user(jurisdiction.user, userId);
    const passkey = $passkey(jurisdiction.passkey, passkeyId);

    const [removedLink, removedPasskey] = await Promise.all([
      removePasskeyLink(user, { guard: guardUser(app), passkeyId }),
      removePasskey(passkey, { guard: guardPasskey(app, userId) }),
    ]);

    if (!removedLink || !removedPasskey) {
      return err(404, { message: "passkey_missing" });
    }

    return ok(200, removedPasskey);
  }
);

const removePasskeyLink = async (
  user: ReturnType<typeof $user>,
  {
    guard,
    passkeyId,
  }: {
    guard: GuardUser;
    passkeyId: DurableObjectId | string;
  }
) => {
  return await user
    .delete(`/remove-passkey/${passkeyId.toString()}`, {
      headers: { Authorization: guard },
    })
    .then((r) => r.ok);
};

const removePasskey = async (
  passkey: ReturnType<typeof $passkey>,
  { guard }: { guard: GuardPasskey }
) => {
  return await passkey
    .delete("/implode", {
      headers: { Authorization: guard },
    })
    .then((r) => r.ok);
};
