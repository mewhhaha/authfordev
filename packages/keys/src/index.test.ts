import { expect, test } from "vitest";
import { decodeHeader, encodeHeader } from ".";
import crypto from "node:crypto";

// @ts-ignore
global.crypto = crypto;

test("encode and decode is isomorphic", async () => {
  const claim = { app: "123" };

  expect(
    await decodeHeader(
      "hello",
      "public",
      await encodeHeader("hello", "public", claim.app)
    )
  ).toEqual(claim.app);
});
