import { expect, test } from "vitest";
import { decodeHeader, encodeHeader } from "./index.js";
import crypto from "node:crypto";

// @ts-ignore
global.crypto = crypto;

test("encode and decode is isomorphic", async () => {
  const claim = { app: "123" };

  expect(
    await decodeHeader(
      "hello",
      "client",
      await encodeHeader("hello", "client", claim.app)
    )
  ).toEqual(claim.app);
});
