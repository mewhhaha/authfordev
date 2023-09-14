import { expect, test } from "vitest";
import { decodeJwt, encodeJwt } from ".";
import crypto from "node:crypto";

// @ts-ignore
global.crypto = crypto;

test("encode and decode is isomorphic", async () => {
  const claim = { id: "123", pk: "456" };

  expect(
    await decodeJwt("hello", await encodeJwt("hello", claim))
  ).toStrictEqual(claim);
});
