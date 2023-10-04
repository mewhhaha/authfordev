import { expect, test } from "vitest";
import { decodeJwt, encodeJwt, jwtTime } from ".";
import crypto from "node:crypto";

// @ts-ignore
global.crypto = crypto;

test("encode and decode is isomorphic", async () => {
  const now = new Date();
  const claim = { jti: "123", sub: "123", exp: jwtTime(now), aud: "lala" };

  expect(
    await decodeJwt("hello", await encodeJwt("hello", claim))
  ).toStrictEqual(claim);
});
