import { fetcher } from "@mewhhaha/little-worker";
import { describe, test, expect, assert, afterEach, beforeEach } from "vitest";
import { UnstableDevWorker, unstable_dev } from "wrangler";
import { Routes } from "./worker";
import { encode } from "@mewhhaha/little-worker/crypto";
import { RegistrationEncoded } from "./helpers/parser";

const authentication = {
  credentialId: "3924HhJdJMy_svnUowT8eoXrOOO6NLP8SK85q2RPxdU",
  authenticatorData: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAAAQ==",
  clientData:
    "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiNTY1MzViMTMtNWQ5My00MTk0LWEyODItZjIzNGMxYzI0NTAwIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDo4MDgwIiwiY3Jvc3NPcmlnaW4iOmZhbHNlLCJvdGhlcl9rZXlzX2Nhbl9iZV9hZGRlZF9oZXJlIjoiZG8gbm90IGNvbXBhcmUgY2xpZW50RGF0YUpTT04gYWdhaW5zdCBhIHRlbXBsYXRlLiBTZWUgaHR0cHM6Ly9nb28uZ2wveWFiUGV4In0=",
  signature:
    "MEUCIAqtFVRrn7q9HvJCAsOhE3oKJ-Hb4ISfjABu4lH70MKSAiEA666slmop_oCbmNZdc-QemTv2Rq4g_D7UvIhWT_vVp8M=",
};

const credentialKey = {
  // obtained from database by looking up `authentication.credentialId`
  id: "3924HhJdJMy_svnUowT8eoXrOOO6NLP8SK85q2RPxdU",
  publicKey:
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEgyYqQmUAmDn9J7dR5xl-HlyAA0R2XV5sgQRnSGXbLt_xCrEdD1IVvvkyTmRD16y9p3C2O4PTZ0OF_ZYD2JgTVA==",
  algorithm: "ES256",
} as const;

const registration = {
  username: "Arnaud",
  credential: {
    id: "3924HhJdJMy_svnUowT8eoXrOOO6NLP8SK85q2RPxdU",
    publicKey:
      "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEgyYqQmUAmDn9J7dR5xl-HlyAA0R2XV5sgQRnSGXbLt_xCrEdD1IVvvkyTmRD16y9p3C2O4PTZ0OF_ZYD2JgTVA==",
    algorithm: "ES256",
  },
  authenticatorData:
    "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NFAAAAAAiYcFjK3EuBtuEw3lDcvpYAIN_duB4SXSTMv7L51KME_HqF6zjjujSz_EivOatkT8XVpQECAyYgASFYIIMmKkJlAJg5_Se3UecZfh5cgANEdl1ebIEEZ0hl2y7fIlgg8QqxHQ9SFb75Mk5kQ9esvadwtjuD02dDhf2WA9iYE1Q=",
  clientData:
    "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiYTdjNjFlZjktZGMyMy00ODA2LWI0ODYtMjQyODkzOGE1NDdlIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDo4MDgwIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ==",
};

describe("authentication", async () => {
  let worker: UnstableDevWorker;

  beforeEach(async () => {
    worker = await unstable_dev("./app/worker.ts", {
      env: "test",
      persist: false,
    });
  });

  afterEach(async () => {
    await worker?.stop();
  });

  test("gets token back", async () => {
    const api = fetcher<Routes>(worker as unknown as { fetch: typeof fetch });
    const response = await api.post("/client/challenges");
    const json = await response.text();
    expect(JSON.parse(json).token).toBeTypeOf("string");
  });

  test("challenge expired", async () => {
    const api = fetcher<Routes>(worker as unknown as { fetch: typeof fetch });

    const { token } = await api
      .post("/client/challenges")
      .then((r) => r.json());

    const response = await api.post("/users", {
      headers: {
        Authorization: "secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "challenge_expired",
        token: `${token}#${encode(JSON.stringify(registration))}`,
        origin: "http://localhost:8080",
      }),
    });

    assert(response.ok, `Status should be ok, but was ${response.status}`);

    {
      const response = await api.post("/users", {
        headers: {
          Authorization: "secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "challenge_expired",
          token: `${token}#${encode(JSON.stringify(registration))}`,
          origin: "http://localhost:8080",
        }),
      });

      assert(
        response.status === 403,
        `Status should be 403, but was ${response.status}`,
      );
      const { message } = await response.json();
      expect(message).toBe("challenge_expired");
    }
  });

  test("credential exists", async () => {
    const api = fetcher<Routes>(worker as unknown as { fetch: typeof fetch });

    const { token } = await api
      .post("/client/challenges")
      .then((r) => r.json());

    const { token: token2 } = await api
      .post("/client/challenges")
      .then((r) => r.json());

    const response = await api.post("/users", {
      headers: {
        Authorization: "secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "user1",
        token: `${token}#${encode(JSON.stringify(registration))}`,
        origin: "http://localhost:8080",
      }),
    });

    assert(response.ok, `Status should be ok, but was ${response.status}`);

    {
      const response = await api.post("/users", {
        headers: {
          Authorization: "secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "user2",
          token: `${token2}#${encode(JSON.stringify(registration))}`,
          origin: "http://localhost:8080",
        }),
      });

      assert(
        response.status === 403,
        `Status should be 403, but was ${response.status}`,
      );
      const { message } = await response.json();
      expect(message).toBe("user_exists");
    }
  });

  test("user exists", async () => {
    const api = fetcher<Routes>(worker as unknown as { fetch: typeof fetch });

    const { token } = await api
      .post("/client/challenges")
      .then((r) => r.json());

    const { token: token2 } = await api
      .post("/client/challenges")
      .then((r) => r.json());

    const response = await api.post("/users", {
      headers: {
        Authorization: "secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "user_exists",
        token: `${token}#${encode(JSON.stringify(registration))}`,
        origin: "http://localhost:8080",
      }),
    });

    assert(response.ok, `Status should be ok, but was ${response.status}`);

    {
      const response = await api.post("/users", {
        headers: {
          Authorization: "secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "user_exists",
          token: `${token2}#${encode(JSON.stringify(registration))}`,
          origin: "http://localhost:8080",
        }),
      });

      assert(
        response.status === 403,
        `Status should be 403, but was ${response.status}`,
      );
      const { message } = await response.json();
      expect(message).toBe("user_exists");
    }
  });

  test("registers and gets user", async () => {
    const api = fetcher<Routes>(worker as unknown as { fetch: typeof fetch });

    const { token } = await api
      .post("/client/challenges")
      .then((r) => r.json());

    const response = await api.post("/users", {
      headers: {
        Authorization: "secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "registers and gets user",
        token: `${token}#${encode(JSON.stringify(registration))}`,
        origin: "http://localhost:8080",
      }),
    });

    assert(response.ok, `Status should be ok, but was ${response.status}`);
    const { userId } = await response.json();

    {
      const response = await api.get(`/users/${userId}`, {
        headers: { Authorization: "secret" },
      });

      assert(response.ok, `Status should be ok, but was ${response.status}`);

      const user = await response.json();
      expect(user.metadata.username).toBe("registers and gets user");
    }
  });

  test("registers and authenticates user", async () => {
    const api = fetcher<Routes>(worker as unknown as { fetch: typeof fetch });

    const { token } = await api
      .post("/client/challenges")
      .then((r) => r.json());

    const response = await api.post("/users", {
      headers: {
        Authorization: "secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "registers and gets user",
        token: `${token}#${encode(JSON.stringify(registration))}`,
        origin: "http://localhost:8080",
      }),
    });

    assert(response.ok, `Status should be ok, but was ${response.status}`);
    const { userId } = await response.json();

    {
      const response = await api.get(`/users/${userId}`, {
        headers: { Authorization: "secret" },
      });

      assert(response.ok, `Status should be ok, but was ${response.status}`);

      const user = await response.json();
      expect(user.metadata.username).toBe("registers and gets user");
    }
  });
});
