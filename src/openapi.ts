/** openapi.ts — the machine-readable door plan, served at /openapi.json.
 *  Kept by hand and deliberately small; the truth is the handler in server.ts. */
import { x402Config } from "./payment.ts";

export function openapiDocument() {
  const x402 = x402Config();
  return {
    openapi: "3.0.3",
    info: {
      title: "fomoscan",
      version: "0.3.0",
      description:
        "Deterministic FOMO/manipulation detector: scans a page, HTML, or text for engineered fear-of-missing-out mechanics, staged per the FOMOENGINE loop with FTC-taxonomy receipts. Scans also carry a `rhetoric` block (rhetorlint/0.1 spec): rhetorical tells in the words — agentless passives, hedges, universal absolutes — reported alongside the FOMO score, never folded into it. `rhetoric` reads a declared bounded prefix on very large documents and is null only if the rhetoric analyzer itself fails (the scan is still delivered). Free doors: /manual (the framework as data) and /honeypot (a test page that should score ~100)." +
        (x402.enabled
          ? ` /scan is x402-paid (${x402.price} USDC on Solana via PAYMENT-SIGNATURE header); a failed scan is never charged.`
          : ""),
    },
    servers: [{ url: "https://api.fomoengine.io" }],
    paths: {
      "/scan": {
        get: {
          summary: "Scan a URL for FOMO-manipulation mechanics",
          parameters: [
            { name: "url", in: "query", required: true, schema: { type: "string", format: "uri" } },
          ],
          responses: {
            "200": { description: "Staged diagnosis with receipts", content: { "application/json": {} } },
            "402": { description: "x402 payment required (challenge in PAYMENT-REQUIRED header)" },
            "400": { description: "missing/invalid input — never charged" },
            "502": { description: "upstream fetch failed — never charged" },
          },
        },
        post: {
          summary: "Scan a URL, raw HTML, or plain text",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", format: "uri" },
                    html: { type: "string" },
                    text: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Staged diagnosis with receipts", content: { "application/json": {} } },
            "402": { description: "x402 payment required (challenge in PAYMENT-REQUIRED header)" },
            "400": { description: "missing/invalid input — never charged" },
          },
        },
      },
      "/manual": {
        get: { summary: "The FOMOENGINE framework as data (free forever)", responses: { "200": { description: "stages, tells, countermeasures, evidence" } } },
      },
      "/honeypot": {
        get: { summary: "A deliberately dark-patterned test page (free forever)", responses: { "200": { description: "should score ~100" } } },
      },
      "/": {
        get: { summary: "Service index incl. live x402 pricing", responses: { "200": { description: "index" } } },
      },
    },
  };
}
