#!/usr/bin/env bun
// CLI: bun run bin/fomoscan.ts <url | file.html | ->   (- reads stdin as text)
import { scan } from "../src/detect.ts";

const arg = process.argv[2];
if (!arg) {
  console.error("usage: fomoscan <url | file.html | ->");
  process.exit(1);
}

let input: string;
let isHtml = true;
if (arg === "-") {
  input = await Bun.stdin.text();
  isHtml = /<[a-z][\s\S]*>/i.test(input);
} else if (/^https?:\/\//.test(arg)) {
  const res = await fetch(arg, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 fomoscan/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) { console.error(`fetch failed: ${res.status}`); process.exit(2); }
  input = await res.text();
} else {
  input = await Bun.file(arg).text();
}

const r = scan(input, { html: isHtml });
const bar = (n: number) => "█".repeat(Math.round(n / 5)).padEnd(20, "·");

console.log(`\n  FOMOENGINE SCAN ${arg === "-" ? "(stdin)" : arg}`);
console.log(`  score  ${String(r.score).padStart(3)}/100  ${bar(r.score)}`);
console.log(`  verdict: ${r.verdict}\n`);
if (r.stages.length) {
  console.log("  stages firing:");
  for (const s of r.stages) console.log(`    [${s.stage}] ${s.name.padEnd(9)} hits=${s.hits}  score=${s.score}`);
  console.log("\n  receipts:");
  for (const rc of r.receipts.slice(0, 12))
    console.log(`    [${rc.stage}·${rc.name}] "${rc.match}"`);
  if (r.receipts.length > 12) console.log(`    … +${r.receipts.length - 12} more`);
}
if (r.rhetoric && r.rhetoric.tells > 0) {
  const rh = r.rhetoric;
  console.log(`\n  rhetoric (rhetorlint): ${rh.tells} tells / ${rh.words} words = ${rh.per100Words} per 100${rh.truncated ? ` (first ${rh.analyzedChars} chars)` : ""}`);
  for (const m of rh.marks.slice(0, 6)) console.log(`    [${m.family}] "${m.match}"`);
  if (rh.marks.length > 6) console.log(`    … +${rh.marks.length - 6} more marks (${rh.tells} tells total)`);
}
console.log("");
