import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { handle } from "../src/server.ts";

/** The x402 gate, exercised against a local mock facilitator.
 *  House rules under test: free doors stay free; unset payTo = open door;
 *  a missing payment gets a well-formed 402 challenge; a verified payment
 *  settles only when the scan succeeds. */

const NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const PAYTO = "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHEBg4";

let mock: ReturnType<typeof Bun.serve>;
const calls = { verify: 0, settle: 0 };
let settleMode: "ok" | "garbage200" = "ok";

function mockFetch(req: Request) {
  const p = new URL(req.url).pathname;
  if (p === "/supported")
    return Response.json({
      kinds: [{ x402Version: 2, scheme: "exact", network: NETWORK, extra: { feePayer: PAYTO } }],
      extensions: [],
      signers: {},
    });
  if (p === "/verify") {
    calls.verify++;
    return Response.json({ isValid: true, payer: PAYTO });
  }
  if (p === "/settle") {
    calls.settle++;
    if (settleMode === "garbage200")
      return new Response("<html>proxy mangled this</html>", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    return Response.json({ success: true, transaction: "5sigSig", network: NETWORK, payer: PAYTO });
  }
  return Response.json({ error: "unknown facilitator path " + p }, { status: 404 });
}

beforeAll(() => {
  mock = Bun.serve({ port: 0, fetch: mockFetch });
  process.env.X402_FACILITATOR = `http://localhost:${mock.port}`;
});
afterAll(() => mock.stop(true));
beforeEach(() => {
  calls.verify = 0;
  calls.settle = 0;
});

const req = (path: string, init?: RequestInit) => handle(new Request(`http://x${path}`, init));
const postScan = (body: unknown, headers: Record<string, string> = {}) =>
  req("/scan", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

function challengeOf(res: Response): any {
  const header = res.headers.get("payment-required");
  expect(header).toBeTruthy();
  return JSON.parse(atob(header!));
}

function paymentHeader(accepted: Record<string, unknown>): string {
  return btoa(
    JSON.stringify({
      x402Version: 2,
      resource: { url: "http://x/scan", description: "", mimeType: "application/json" },
      accepted,
      // unique per call — like a real client's freshly signed transaction
      payload: { transaction: btoa(`signed-tx-bytes:${crypto.randomUUID()}`) },
    }),
  );
}

describe("the x402 gate", () => {
  test("door is open when X402_PAYTO is unset", async () => {
    delete process.env.X402_PAYTO;
    const res = await postScan({ text: "BUY NOW!! last chance, 10x guaranteed!!" });
    expect(res.status).toBe(200);
    const out = (await res.json()) as any;
    expect(out.score).toBeGreaterThan(0);
  });

  test("free doors stay free even with the gate armed", async () => {
    process.env.X402_PAYTO = PAYTO;
    for (const path of ["/", "/manual", "/honeypot"]) {
      const res = await req(path);
      expect(res.status).toBe(200);
    }
    const index = (await (await req("/")).json()) as any;
    expect(index.pricing.protocol).toBe("x402");
    expect(index.pricing.payTo).toBe(PAYTO);
  });

  test("unpaid scan gets a 402 challenge with a solana accepts row (both methods)", async () => {
    process.env.X402_PAYTO = PAYTO;
    for (const res of [await req("/scan?url=https://example.com"), await postScan({ text: "hi" })]) {
      expect(res.status).toBe(402);
      const challenge = challengeOf(res);
      expect(challenge.x402Version).toBe(2);
      expect(challenge.accepts[0].network).toBe(NETWORK);
      expect(challenge.accepts[0].payTo).toBe(PAYTO);
      expect(challenge.accepts[0].amount).toBe("10000"); // $0.01 in 6-decimal USDC
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("access-control-expose-headers")).toContain("payment-required");
    }
  });

  test("a verified payment is settled after a successful scan", async () => {
    process.env.X402_PAYTO = PAYTO;
    const accepted = challengeOf(await postScan({ text: "x" })).accepts[0];
    const res = await postScan(
      { text: "act fast — only 3 left, everyone is buying!" },
      { "PAYMENT-SIGNATURE": paymentHeader(accepted) },
    );
    expect(res.status).toBe(200);
    expect(calls.verify).toBe(1);
    expect(calls.settle).toBe(1);
    expect(res.headers.get("payment-response")).toBeTruthy();
  });

  test("a failed scan is never charged", async () => {
    process.env.X402_PAYTO = PAYTO;
    const accepted = challengeOf(await postScan({ text: "x" })).accepts[0];
    const res = await postScan({}, { "PAYMENT-SIGNATURE": paymentHeader(accepted) });
    expect(res.status).toBe(400);
    expect(calls.settle).toBe(0);
  });

  test("facilitator outage opens the door instead of closing it", async () => {
    process.env.X402_PAYTO = PAYTO;
    process.env.X402_FACILITATOR = "http://localhost:1"; // nothing listens here
    const res = await postScan({ text: "fear of missing out" });
    expect(res.status).toBe(200);
    process.env.X402_FACILITATOR = `http://localhost:${mock.port}`;
  });

  test("warm-cache outage also opens the door (health probe)", async () => {
    process.env.X402_PAYTO = PAYTO;
    expect((await postScan({ text: "warm" })).status).toBe(402); // warm the cache
    const port = mock.port;
    mock.stop(true); // facilitator dies AFTER a healthy init
    try {
      // the 60s health cache may still say ok — force a fresh probe by
      // flipping the facilitator URL to the (now dead) same port
      process.env.X402_FACILITATOR = `http://127.0.0.1:${port}`;
      const res = await postScan({ text: "outage after warm cache" });
      expect(res.status).toBe(200); // door open, not a 402 wall
    } finally {
      mock = Bun.serve({ port: 0, fetch: mockFetch });
      process.env.X402_FACILITATOR = `http://localhost:${mock.port}`;
    }
  });

  test("non-GET/POST methods cannot slip past the gate", async () => {
    process.env.X402_PAYTO = PAYTO;
    for (const method of ["PUT", "DELETE", "PATCH"]) {
      const res = await req("/scan?url=https://example.com", { method });
      expect(res.status).toBe(405);
    }
  });

  test("each payment buys exactly one scan (duplicate refused)", async () => {
    process.env.X402_PAYTO = PAYTO;
    const accepted = challengeOf(await postScan({ text: "x" })).accepts[0];
    const header = paymentHeader(accepted);
    const first = await postScan({ text: "one" }, { "PAYMENT-SIGNATURE": header });
    expect(first.status).toBe(200);
    const second = await postScan({ text: "two" }, { "PAYMENT-SIGNATURE": header });
    expect(second.status).toBe(402);
    expect(((await second.json()) as any).error).toContain("duplicate");
  });

  test("ambiguous settlement delivers the answer flagged unknown, never withholds", async () => {
    process.env.X402_PAYTO = PAYTO;
    settleMode = "garbage200"; // facilitator answers 200 with an unparseable body
    try {
      const accepted = challengeOf(await postScan({ text: "x" })).accepts[0];
      const res = await postScan(
        { text: "everyone is buying, act now" },
        { "PAYMENT-SIGNATURE": paymentHeader(accepted) },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("payment-settlement")).toBe("unknown");
      const out = (await res.json()) as any;
      expect(out.score).toBeGreaterThan(0);
    } finally {
      settleMode = "ok";
    }
  });
});
