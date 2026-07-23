import { describe, expect, test } from "bun:test";
import { scan } from "../src/detect.ts";
import { HONEYPOT_HTML } from "../src/honeypot.ts";

describe("fomoengine detector", () => {
  test("honeypot scores near maximum with many stages firing", () => {
    const r = scan(HONEYPOT_HTML, { html: true });
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.stages.length).toBeGreaterThanOrEqual(5);
    expect(r.rulesFired).toBeGreaterThanOrEqual(8);
    const ids = new Set(r.receipts.map((x) => x.rule));
    expect(ids.has("baseless-countdown")).toBe(true);
    expect(ids.has("false-low-stock")).toBe(true);
    expect(ids.has("false-activity")).toBe(true);
  });

  test("neutral prose scores zero", () => {
    const r = scan(
      "The library opens at nine. The documentation covers installation, configuration, and testing. " +
        "Chapter four discusses error handling in depth.",
      { html: false },
    );
    expect(r.score).toBe(0);
    expect(r.receipts.length).toBe(0);
  });

  test("single mild widget stays in low band", () => {
    const r = scan("<p>Bestseller</p>", { html: true });
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(20);
  });

  test("dedupes repeated identical widgets", () => {
    const spam = Array(30).fill("<span>Only 3 left in stock</span>").join("");
    const r = scan(spam, { html: true });
    const lowStock = r.receipts.filter((x) => x.rule === "false-low-stock");
    expect(lowStock.length).toBe(1); // identical strings collapse
  });

  test("loss-framed capital narrative fires money/validate stages", () => {
    const r = scan(
      "Analysts say the arms race means no one can afford to sit out the platform shift. " +
        "Record spending continues; the bear thesis is garbage. Early movers win — don't get left behind.",
      { html: false },
    );
    const stages = new Set(r.stages.map((s) => s.stage));
    expect(stages.has(5)).toBe(true);
    expect(stages.has(6)).toBe(true);
  });

  test("receipts carry context and citations", () => {
    const r = scan("Hurry — offer ends in 09:59! Only 2 left in stock.", { html: false });
    expect(r.receipts.length).toBeGreaterThan(0);
    for (const rc of r.receipts) {
      expect(rc.context.length).toBeGreaterThan(0);
      expect(rc.ref.length).toBeGreaterThan(0);
    }
  });

  test("rhetoric block rides along with real marks on spun prose", () => {
    const r = scan("Mistakes were made. Everyone knows this is guaranteed to work, always.", { html: false });
    expect(r.rhetoric).not.toBeNull();
    expect(r.rhetoric!.tells).toBeGreaterThan(0);
    expect(r.rhetoric!.per100Words).toBeGreaterThan(0);
    expect(r.rhetoric!.spec).toBe("rhetorlint/0.1");
    for (const m of r.rhetoric!.marks) {
      expect(m.match.length).toBeGreaterThan(0);
      expect(m.family.length).toBeGreaterThan(0);
      expect(m.rule.length).toBeGreaterThan(0);
    }
    const families = new Set(r.rhetoric!.marks.map((m) => m.family));
    expect(families.has("agency-hiding")).toBe(true); // "were made"
  });

  test("rhetoric on clean prose is zero tells, not null", () => {
    const r = scan("The library opens at nine. Chapter four discusses error handling in depth.", { html: false });
    expect(r.rhetoric).not.toBeNull();
    expect(r.rhetoric!.tells).toBe(0);
    expect(r.rhetoric!.marks.length).toBe(0);
  });

  test("rhetoric reads the text layer of html, not the markup", () => {
    const r = scan("<div data-x='guaranteed'><p>Mistakes were made.</p></div>", { html: true });
    expect(r.rhetoric).not.toBeNull();
    expect(r.rhetoric!.marks.some((m) => m.match.toLowerCase().includes("were made"))).toBe(true);
  });

  test("rhetoric marks are capped but the tell count stays honest", () => {
    const spam = Array(60).fill("Mistakes were made.").join(" ");
    const r = scan(spam, { html: false });
    expect(r.rhetoric).not.toBeNull();
    expect(r.rhetoric!.tells).toBeGreaterThan(24);
    expect(r.rhetoric!.marks.length).toBeLessThanOrEqual(24);
  });

  test("rhetoric declares truncation on huge documents and stays fast", () => {
    const huge = ("Mistakes were made. The library opens at nine. ").repeat(45_000); // ~2.1MB
    const t0 = performance.now();
    const r = scan(huge, { html: false });
    const elapsed = performance.now() - t0;
    expect(r.rhetoric).not.toBeNull();
    expect(r.rhetoric!.truncated).toBe(true);
    expect(r.rhetoric!.analyzedChars).toBe(100_000);
    expect(r.rhetoric!.tells).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(10_000); // the 2MB un-capped path measured 22-90s; capped must be far under
  });

  test("rhetoric never moves the FOMO score", () => {
    // same FOMO trigger with and without extra rhetoric-only tells around it
    const bare = scan("Only 2 left in stock.", { html: false });
    const spun = scan("Everyone always knows mistakes were made. Only 2 left in stock.", { html: false });
    expect(spun.score).toBe(bare.score);
    expect(spun.rhetoric!.tells).toBeGreaterThan(bare.rhetoric!.tells);
  });
});
