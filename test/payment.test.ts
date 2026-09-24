import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { handle } from "../src/server.ts";
import { x402Config } from "../src/payment.ts";

const savedFetch = globalThis.fetch;
const savedEnv = { payTo: process.env.X402_PAYTO, facilitator: process.env.X402_FACILITATOR };
let networkCalls = 0;
beforeEach(() => {
  process.env.X402_PAYTO = "legacy-receiver";
  process.env.X402_FACILITATOR = "https://facilitator.invalid";
  networkCalls = 0;
  globalThis.fetch = (() => { networkCalls++; throw new Error("Unexpected network call"); }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = savedFetch;
  for (const [key, value] of [["X402_PAYTO", savedEnv.payTo], ["X402_FACILITATOR", savedEnv.facilitator]]) {
    if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});
const request = (path: string, init?: RequestInit) => handle(new Request(`http://fixture${path}`, init));

describe("retired payment admission", () => {
  test("legacy receiver cannot enable billing", () => {
    expect(x402Config().enabled).toBe(false);
    expect(x402Config().retired).toBe(true);
  });
  for (const signature of [undefined, "old-payment-signature", "malformed"] ) {
    test(`scan ignores payment material: ${signature ?? "none"}`, async () => {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (signature) headers["PAYMENT-SIGNATURE"] = signature;
      const response = await request("/scan", { method: "POST", headers, body: JSON.stringify({ text: "Act now, only2left!" }) });
      expect(response.status).toBe(200);
      expect((await response.json()).receipts).toBeArray();
      expect(response.headers.has("payment-required")).toBe(false);
      expect(response.headers.has("payment-response")).toBe(false);
      expect(networkCalls).toBe(0);
    });
  }
  test("empty input retains validation without a payment request", async () => {
    const response = await request("/scan", { method: "POST", body: "{}" });
    expect(response.status).toBe(400);
    expect(networkCalls).toBe(0);
  });
  test("index and OpenAPI offer no paid door", async () => {
    const index = await (await request("/")).json();
    expect(index.pricing.purchases).toBe("retired");
    expect(index.pricing.paid).toEqual([]);
    const spec = await (await request("/openapi.json")).json();
    expect(spec.paths["/scan"].post.responses["402"]).toBeUndefined();
    expect(spec.paths["/scan"].get.responses["402"]).toBeUndefined();
    expect(networkCalls).toBe(0);
  });
});
