import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./worker";

describe("authentication", () => {
  it("gets token back", async () => {
    const request = new Request("http://example.com/client/challenges", {
      method: "POST",
    });
    const response = await SELF.fetch(request, env);
    expect(await response.json()).toEqual({ token: "token" });
  });
});
