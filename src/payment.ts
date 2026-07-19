/** payment.ts — the x402 gate on the paid door (/scan).
 *
 * USDC on Solana via the official @x402/* SDK; the PayAI facilitator verifies
 * and settles (it fronts all network fees — we only hold a receiving address).
 *
 * House rules, in order of importance:
 *  1. The gate exists only when X402_PAYTO is set. Unset ⇒ the door is free
 *     (public-good default; enabling is a deliberate operator act).
 *  2. If the facilitator is down or hanging, the door falls OPEN, never
 *     closed — an outage may cost us revenue; it must never cost a guest
 *     the answer. A health probe (3s timeout, 60s cache) covers the
 *     warm-cache case; hard timeouts cover hangs mid-request.
 *  3. Never charge-and-withhold. A definitive settlement failure (the
 *     facilitator says no) withholds the answer — nobody was charged. An
 *     AMBIGUOUS settlement (timeout, unparseable response after a 200) may
 *     have charged the buyer, so the answer is delivered with a
 *     `payment-settlement: unknown` header instead of being withheld.
 *  4. A failed scan (4xx/5xx) is never charged.
 */
import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@x402/core/server";
import type { HTTPAdapter, HTTPProcessResult, HTTPResponseInstructions } from "@x402/core/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";

export const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

const GATE_TIMEOUT_MS = 10_000; // verify path
const SETTLE_TIMEOUT_MS = 20_000; // settle path — ambiguity boundary, not a wall
const HEALTH_TIMEOUT_MS = 3_000;
const HEALTH_CACHE_MS = 60_000;
const INIT_RETRY_MS = 60_000;

export function x402Config() {
  const payTo = (process.env.X402_PAYTO ?? "").trim();
  return {
    payTo,
    enabled: payTo.length > 0,
    network: process.env.X402_NETWORK ?? SOLANA_MAINNET,
    price: process.env.X402_PRICE ?? "$0.01",
    facilitator: process.env.X402_FACILITATOR ?? "https://facilitator.payai.network",
  };
}

let cached: { key: string; server: x402HTTPResourceServer } | null = null;
let initFailedAt = 0;
let health: { url: string; ok: boolean; at: number } | null = null;

/** Rule 2's warm-cache leg: is the facilitator answering at all right now? */
async function facilitatorHealthy(url: string): Promise<boolean> {
  if (health && health.url === url && Date.now() - health.at < HEALTH_CACHE_MS) return health.ok;
  let ok = false;
  try {
    const res = await fetch(`${url}/supported`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    ok = res.ok;
  } catch {
    ok = false;
  }
  health = { url, ok, at: Date.now() };
  return ok;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/** Build (or reuse) the resource server. Returns null when init fails — callers fall open. */
async function gateServer(): Promise<x402HTTPResourceServer | null> {
  const cfg = x402Config();
  const key = `${cfg.payTo}|${cfg.network}|${cfg.price}|${cfg.facilitator}`;
  if (cached?.key === key) return cached.server;
  if (Date.now() - initFailedAt < INIT_RETRY_MS) return null;
  try {
    const core = new x402ResourceServer(new HTTPFacilitatorClient({ url: cfg.facilitator }))
      .register(cfg.network, new ExactSvmScheme());
    const accepts = { scheme: "exact", payTo: cfg.payTo, price: cfg.price, network: cfg.network };
    const route = {
      accepts,
      description: "Deterministic FOMO/manipulation diagnosis with receipts (FTC-taxonomy rules)",
      mimeType: "application/json",
      serviceName: "fomoscan",
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: {
          error: "payment required",
          hint: "retry with an x402 PAYMENT-SIGNATURE header; free doors: GET /manual, GET /honeypot",
        },
      }),
      settlementFailedResponseBody: () => ({
        contentType: "application/json",
        body: {
          error: "payment settlement failed — you were NOT charged",
          hint: "the facilitator declined settlement (expired or unfundable payment?); sign a fresh payment and retry",
        },
      }),
    };
    const server = new x402HTTPResourceServer(core, { "GET /scan": route, "POST /scan": route });
    await withTimeout(server.initialize(), GATE_TIMEOUT_MS, "facilitator initialize");
    cached = { key, server };
    initFailedAt = 0;
    return server;
  } catch (e) {
    initFailedAt = Date.now();
    cached = null;
    console.error(`x402 gate init failed (door stays open): ${String((e as Error).message ?? e)}`);
    return null;
  }
}

function adapterFor(req: Request, url: URL): HTTPAdapter {
  return {
    getHeader: (name) => req.headers.get(name) ?? undefined,
    getMethod: () => req.method,
    getPath: () => url.pathname,
    getUrl: () => url.toString(),
    getAcceptHeader: () => req.headers.get("accept") ?? "",
    getUserAgent: () => req.headers.get("user-agent") ?? "",
    getQueryParams: () => Object.fromEntries(url.searchParams),
    getQueryParam: (name) => url.searchParams.get(name) ?? undefined,
  };
}

function toResponse(instr: HTTPResponseInstructions): Response {
  const headers = new Headers({
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "payment-response, payment-required, payment-settlement",
    ...instr.headers,
  });
  if (instr.isHtml) {
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(String(instr.body ?? ""), { status: instr.status, headers });
  }
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(instr.body ?? {}, null, 2), { status: instr.status, headers });
}

// One payment, one scan: recently-seen and in-flight PAYMENT-SIGNATURE values
// are refused. Single-instance memory is enough — the fly app runs one machine.
const seenSignatures = new Set<string>();
const SEEN_MAX = 500;
function claimSignature(sig: string): boolean {
  if (seenSignatures.has(sig)) return false;
  seenSignatures.add(sig);
  if (seenSignatures.size > SEEN_MAX) {
    const oldest = seenSignatures.values().next().value;
    if (oldest !== undefined) seenSignatures.delete(oldest);
  }
  return true;
}

export type Gate =
  | { kind: "open" }
  | { kind: "deny"; response: Response }
  | { kind: "paid"; finalize: (res: Response) => Promise<Response> };

/** Decide the fate of a /scan request. Call BEFORE consuming the request body. */
export async function gateScan(req: Request): Promise<Gate> {
  const cfg = x402Config();
  if (!cfg.enabled) return { kind: "open" };
  if (!(await facilitatorHealthy(cfg.facilitator))) return { kind: "open" }; // rule 2, warm or cold
  const server = await gateServer();
  if (!server) return { kind: "open" };

  const url = new URL(req.url);
  const signature = req.headers.get("PAYMENT-SIGNATURE");
  if (signature && !claimSignature(signature)) {
    return {
      kind: "deny",
      response: toResponse({
        status: 402,
        headers: {},
        body: { error: "duplicate payment — each PAYMENT-SIGNATURE buys exactly one scan" },
      }),
    };
  }

  let result: HTTPProcessResult;
  try {
    result = await withTimeout(
      server.processHTTPRequest({
        adapter: adapterFor(req, url),
        path: url.pathname,
        method: req.method,
        paymentHeader: signature ?? undefined,
      }),
      GATE_TIMEOUT_MS,
      "payment verification",
    );
  } catch (e) {
    console.error(`x402 verification failed open: ${String((e as Error).message ?? e)}`);
    return { kind: "open" }; // rule 2: a hung/broken verify path never blocks the guest
  }

  if (result.type === "no-payment-required") return { kind: "open" };
  if (result.type === "payment-error") return { kind: "deny", response: toResponse(result.response) };

  const verified = result;
  return {
    kind: "paid",
    finalize: async (res) => {
      if (res.status >= 400) return res; // rule 4: a failed answer is never charged
      try {
        const settled = await withTimeout(
          server.processSettlement(
            verified.paymentPayload,
            verified.paymentRequirements,
            verified.declaredExtensions,
          ),
          SETTLE_TIMEOUT_MS,
          "settlement",
        );
        if (!settled.success) return toResponse(settled.response); // definitive no-charge: withhold
        const headers = new Headers(res.headers);
        for (const [k, v] of Object.entries(settled.headers)) headers.set(k, v);
        return new Response(res.body, { status: res.status, headers });
      } catch (e) {
        // Ambiguous: the facilitator may have settled (e.g. 200 with an
        // unparseable body, or a timeout after broadcast). Rule 3: never
        // charge-and-withhold — deliver the answer, flag the ambiguity.
        console.error(`x402 settlement ambiguous, answer delivered: ${String((e as Error).message ?? e)}`);
        const headers = new Headers(res.headers);
        headers.set("payment-settlement", "unknown");
        return new Response(res.body, { status: res.status, headers });
      }
    },
  };
}
