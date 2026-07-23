import { RULES, STAGE_NAMES, type Rule } from "./rules.ts";
import { analyze, SPEC_VERSION, type RhetorLintRulePack } from "@rhetorlint/core";
import rhetoricRulesEn from "@rhetorlint/rules-en" with { type: "json" };

export interface Receipt {
  rule: string;
  name: string;
  stage: number;
  stageName: string;
  bias: string;
  match: string;
  context: string;
  ref: string;
}

export interface StageScore {
  stage: number;
  name: string;
  hits: number;
  score: number;
}

export interface RhetoricMark {
  rule: string;
  family: string;
  technique?: string;
  match: string;
  note?: string;
  confidence?: number;
}

export interface RhetoricBlock {
  tells: number; // total marks in the analysed text — honest even when `marks` is capped
  words: number;
  per100Words: number;
  marks: RhetoricMark[]; // first RHETORIC_MARK_CAP of them
  analyzedChars: number; // rhetoric lens reads at most RHETORIC_MAX_CHARS; truncation is declared, never silent
  truncated: boolean;
  spec: string;
  method: string;
}

export interface ScanResult {
  score: number; // 0–100
  verdict: string;
  stages: StageScore[];
  receipts: Receipt[];
  rulesFired: number;
  scannedChars: number;
  rhetoric: RhetoricBlock | null;
}

// Strip tags but keep attribute values that carry dark-pattern hints
// (data-countdown etc. are matched against the raw html separately).
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&amp;|&quot;|&#\d+;|&\w+;/g, " ")
    .replace(/\s+/g, " ");
}

const RHETORIC_MARK_CAP = 24;
// analyze() cost grows superlinearly with input size (a 2MB doc measures in
// tens of seconds and would stall the single-process seller-loop mid-sale);
// the lens reads a bounded prefix and says so, rather than reading everything slowly.
const RHETORIC_MAX_CHARS = 100_000;

/** RhetorLint enrichment: an independent second lens on the same text.
 *  Marks rhetorical tells in the words (agentless passives, hedges,
 *  universal absolutes…) per the rhetorlint/0.1 spec. It never alters the
 *  FOMO score, and a failure here must never break the scan itself. */
function rhetoricFor(text: string): RhetoricBlock | null {
  try {
    const truncated = text.length > RHETORIC_MAX_CHARS;
    const sample = truncated ? text.slice(0, RHETORIC_MAX_CHARS) : text;
    const r = analyze(sample, { rules: rhetoricRulesEn as RhetorLintRulePack });
    return {
      tells: r.density.tells,
      words: r.source.words,
      per100Words: r.density.per100Words,
      marks: r.marks.slice(0, RHETORIC_MARK_CAP).map((m) => ({
        rule: m.ruleId,
        family: m.family,
        technique: m.technique,
        match: m.actual,
        note: m.note,
        confidence: m.confidence,
      })),
      analyzedChars: sample.length,
      truncated,
      spec: `rhetorlint/${SPEC_VERSION}`,
      method: "rhetorical tells in the words; reads the language, never the person; never moves the FOMO score",
    };
  } catch (e) {
    console.error(`rhetoric enrichment failed (scan unaffected): ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

function verdictFor(score: number): string {
  if (score >= 70) return "FULL FOMOENGINE — the loop is running at you, on purpose";
  if (score >= 45) return "ENGINE RUNNING — multiple stages active, assume the urgency is manufactured";
  if (score >= 20) return "ENGINE WARMING — scattered FOMO mechanics present";
  if (score > 0) return "AMBIENT — trace signals only";
  return "CLEAN — no engineered-FOMO mechanics detected";
}

export function scan(input: string, opts: { html?: boolean } = {}): ScanResult {
  const isHtml = opts.html ?? /<[a-z][\s\S]*>/i.test(input);
  const text = isHtml ? htmlToText(input) : input;
  // Countdown JS/attr hints only make sense against raw markup:
  const surfaces: Array<{ body: string; ruleFilter?: (r: Rule, p: RegExp) => boolean }> = isHtml
    ? [{ body: text }, { body: input, ruleFilter: (_r, p) => /data-|countdown/i.test(p.source) }]
    : [{ body: text }];

  const receipts: Receipt[] = [];
  const perRuleHits = new Map<string, number>();

  for (const rule of RULES) {
    const seen = new Set<string>();
    for (const surface of surfaces) {
      for (const pattern of rule.patterns) {
        if (surface.ruleFilter && !surface.ruleFilter(rule, pattern)) continue;
        const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
        for (const m of surface.body.matchAll(re)) {
          const idx = m.index ?? 0;
          const matchText = m[0].trim();
          const key = matchText.toLowerCase();
          if (seen.has(key)) continue; // dedupe identical strings (repeated widgets)
          seen.add(key);
          const hits = (perRuleHits.get(rule.id) ?? 0) + 1;
          perRuleHits.set(rule.id, hits);
          if (hits <= rule.cap) {
            receipts.push({
              rule: rule.id,
              name: rule.name,
              stage: rule.stage,
              stageName: STAGE_NAMES[rule.stage],
              bias: rule.bias,
              match: matchText,
              context: surface.body.slice(Math.max(0, idx - 60), idx + matchText.length + 60).trim(),
              ref: rule.ref,
            });
          }
        }
      }
    }
  }

  let raw = 0;
  const stageAgg = new Map<number, { hits: number; score: number }>();
  for (const rule of RULES) {
    const hits = Math.min(perRuleHits.get(rule.id) ?? 0, rule.cap);
    if (!hits) continue;
    const s = hits * rule.weight;
    raw += s;
    const agg = stageAgg.get(rule.stage) ?? { hits: 0, score: 0 };
    agg.hits += hits;
    agg.score += s;
    stageAgg.set(rule.stage, agg);
  }
  // Diversity bonus: distinct stages firing means the loop, not a lone widget.
  const distinctStages = stageAgg.size;
  if (distinctStages >= 3) raw *= 1.15;
  if (distinctStages >= 5) raw *= 1.1;

  const score = Math.min(100, Math.round(raw));
  const stages: StageScore[] = [...stageAgg.entries()]
    .map(([stage, a]) => ({ stage, name: STAGE_NAMES[stage], hits: a.hits, score: Math.round(a.score) }))
    .sort((a, b) => a.stage - b.stage);

  return {
    score,
    verdict: verdictFor(score),
    stages,
    receipts,
    rulesFired: [...perRuleHits.keys()].length,
    scannedChars: text.length,
    rhetoric: rhetoricFor(text),
  };
}
