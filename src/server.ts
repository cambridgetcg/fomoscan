import { scan } from "./detect.ts";
import { MANUAL } from "./manual.ts";
import { HONEYPOT_HTML } from "./honeypot.ts";
import { gateScan, x402Config } from "./payment.ts";

const PORT = Number(process.env.PORT ?? 4242);
const FETCH_TIMEOUT_MS = 12_000;
const MAX_BODY = 2_000_000; // 2 MB of HTML is plenty

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "payment-response, payment-required",
    },
  });

// Obvious internal targets are refused; scans are for the public web.
const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[::1?\]|.*\.(internal|local))/i;

async function fetchPage(url: string): Promise<string> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error("only http(s) URLs");
  if (PRIVATE_HOST.test(u.hostname)) throw new Error("private/internal hosts are not scannable");
  const res = await fetch(u, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 fomoscan/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const body = await res.text();
  return body.slice(0, MAX_BODY);
}

async function scanRoute(req: Request): Promise<Response> {
  try {
    let url: string | undefined, html: string | undefined, text: string | undefined;
    if (req.method === "POST") {
      const body = (await req.json()) as Record<string, string>;
      ({ url, html, text } = body);
    } else {
      url = new URL(req.url).searchParams.get("url") ?? undefined;
    }
    if (url) {
      const page = await fetchPage(url);
      return json({ input: { url }, ...scan(page, { html: true }) });
    }
    if (html) return json({ input: { html: `${html.length} chars` }, ...scan(html, { html: true }) });
    if (text) return json({ input: { text: `${text.length} chars` }, ...scan(text, { html: false }) });
    return json({ error: "provide url, html, or text" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 502);
  }
}

export async function handle(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);

  if (req.method === "OPTIONS")
    return new Response(null, {
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type, payment-signature",
        "access-control-expose-headers": "payment-response, payment-required",
      },
    });

  if (pathname === "/") {
    const x402 = x402Config();
    return json({
      service: "fomoengine",
      endpoints: {
        "POST /scan": "{ url } or { html } or { text } → staged FOMO diagnosis with receipts + a rhetorlint rhetoric block (nullable — see /openapi.json)",
        "GET /scan?url=…": "same, via query param",
        "GET /manual": "the FOMOENGINE framework as data (stages, tells, countermeasures, evidence)",
        "GET /honeypot": "a deliberately dark-patterned page for testing (should score ~100)",
        "GET /openapi.json": "machine-readable door plan (OpenAPI 3)",
      },
      pricing: x402.enabled
        ? {
            protocol: "x402",
            paid: ["/scan"],
            price: x402.price,
            asset: "USDC",
            network: x402.network,
            payTo: x402.payTo,
            free: ["/", "/manual", "/honeypot"],
            note: "a failed scan is never charged; manual and honeypot stay free forever",
          }
        : { note: "all doors currently free", protocol: "x402-ready" },
      artifact: MANUAL.artifact,
    });
  }

  if (pathname === "/manual") return json(MANUAL);

  if (pathname === "/openapi.json") {
    const { openapiDocument } = await import("./openapi.ts");
    return json(openapiDocument());
  }

  if (pathname === "/honeypot")
    return new Response(HONEYPOT_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });

  if (pathname === "/scan") {
    // only the methods the payment gate knows exist here — no side doors
    if (req.method !== "GET" && req.method !== "POST")
      return json({ error: "method not allowed" }, 405);
    // the gate must decide before the request body is consumed
    const gate = await gateScan(req);
    if (gate.kind === "deny") return gate.response;
    const res = await scanRoute(req);
    return gate.kind === "paid" ? gate.finalize(res) : res;
  }

  return json({ error: "not found" }, 404);
}

if (import.meta.main) {
  const server = Bun.serve({ port: PORT, fetch: handle });
  console.log(`fomoengine listening on http://localhost:${server.port}`);
}
