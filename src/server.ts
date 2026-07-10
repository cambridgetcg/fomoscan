import { scan } from "./detect.ts";
import { MANUAL } from "./manual.ts";
import { HONEYPOT_HTML } from "./honeypot.ts";

const PORT = Number(process.env.PORT ?? 4242);
const FETCH_TIMEOUT_MS = 12_000;
const MAX_BODY = 2_000_000; // 2 MB of HTML is plenty

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
  });

async function fetchPage(url: string): Promise<string> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error("only http(s) URLs");
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

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);

    if (req.method === "OPTIONS")
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });

    if (pathname === "/" ) {
      return json({
        service: "fomoengine",
        endpoints: {
          "POST /scan": "{ url } or { html } or { text } → staged FOMO diagnosis with receipts",
          "GET /scan?url=…": "same, via query param",
          "GET /manual": "the FOMOENGINE framework as data (stages, tells, countermeasures, evidence)",
          "GET /honeypot": "a deliberately dark-patterned page for testing (should score ~100)",
        },
        artifact: MANUAL.artifact,
      });
    }

    if (pathname === "/manual") return json(MANUAL);

    if (pathname === "/honeypot")
      return new Response(HONEYPOT_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });

    if (pathname === "/scan") {
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

    return json({ error: "not found" }, 404);
  },
});

console.log(`fomoengine listening on http://localhost:${server.port}`);
