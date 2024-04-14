import { DurableObject, RpcTarget } from "cloudflare:workers";
import { store, storage, $get } from "../helpers/durable";

type PasskeyLink = {
  name: string;
  credentialId: string;
  userId: string;
  passkeyId: string;
};

/** @public */
export type Metadata = {
  username: string;
};

/** @public */
export type Recovery = {
  emails: { address: string; verified: boolean; primary: boolean }[];
};

export class DurableObjectUser extends DurableObject<Env> {
  @storage
  accessor #metadata = store<Metadata>();

  @storage
  accessor #recovery = store<Recovery>({ emails: [] });

  @storage
  accessor #passkeys = store<PasskeyLink[]>([]);

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async exists() {
    try {
      await this.#assertUser();
      return true;
    } catch {
      return false;
    }
  }

  async create({
    email,
    passkey,
    username,
  }: Metadata & { email?: string; passkey?: PasskeyLink }) {
    await this.#assertEmpty();

    this.#metadata = Promise.resolve({ username });
    if (email !== undefined) {
      this.#recovery = store({
        emails: [{ address: email, verified: false, primary: true }],
      });
    }
    if (passkey !== undefined) {
      this.#passkeys = store([passkey]);
    }
  }

  async data() {
    return await this.#assertUser();
  }

  async verifyEmail(unverifiedEmail: string) {
    await this.#assertUser();

    const { emails } = await this.#recovery;
    const email = emails.find((e) => e.address === unverifiedEmail);
    if (email === undefined) {
      return { error: true, message: "missing_email" } as const;
    }

    email.verified = true;
    this.#recovery = store({ emails });
    return { error: false } as const;
  }

  async addPasskey(link: PasskeyLink) {
    const { passkeys } = await this.#assertUser();
    const added = [...passkeys, link];

    this.#passkeys = store(added);
    return { passkeys: added };
  }

  async getPasskey(passkeyId: string) {
    const { passkeys } = await this.#assertUser();
    const passkey = passkeys.find((p) => p.passkeyId === passkeyId);
    if (!passkey) {
      throw new Error(`Missing passkey with id ${passkeyId}`);
    }

    const rename = async (name: string) => {
      passkey.name = name;
      this.#passkeys = store(passkeys);

      return { passkeys } as const;
    };

    const remove = async () => {
      const removed = passkeys.filter((p) => p.passkeyId !== passkeyId);
      if (removed.length === passkeys.length) {
        return { error: true, message: "missing_passkey" } as const;
      }

      const passkey = $get(this.env.DO_PASSKEY, passkeyId);
      this.ctx.waitUntil(passkey.destruct());

      this.#passkeys = store(removed);

      return { error: false, passkey: removed } as const;
    };

    class RpcTargetPasskey extends RpcTarget {
      rename = rename;
      remove = remove;
    }

    return new RpcTargetPasskey();
  }

  async #assertUser() {
    const metadata = await this.#metadata;
    const recovery = await this.#recovery;
    const passkeys = await this.#passkeys;
    if (metadata === undefined) {
      throw new Error("Object is unoccupied");
    }

    return { metadata, recovery, passkeys };
  }
  async #assertEmpty() {
    if ((await this.#metadata) !== undefined) {
      throw new Error("Object is occupied");
    }
  }
}

export const makePasskeyLink = ({
  passkeyId,
  credentialId,
  userId,
}: {
  passkeyId: DurableObjectId | string;
  credentialId: string;
  userId: DurableObjectId | string;
}): PasskeyLink => {
  const passkeyIdString = passkeyId.toString();
  return {
    passkeyId: passkeyIdString,
    credentialId,
    userId: userId.toString(),
    name: `passkey-${passkeyIdString.slice(0, 3) + passkeyIdString.slice(-3)}`,
  };
};
