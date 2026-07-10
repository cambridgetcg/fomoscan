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
});
