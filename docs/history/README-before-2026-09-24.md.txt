# fomoengine

Deterministic detector for engineered fear-of-missing-out. Scan any URL, HTML, or text and get a
stage-by-stage diagnosis of which FOMO mechanics are running at you — with receipts.

The operational companion to the FOMOENGINE field manual
(https://claude.ai/code/artifact/1c1de169-475a-4273-ade4-6c6cdb09a550): a research-verified framework
(66 claims through adversarial panels, 0 refuted) describing the loop
**Signal → Proof → Cascade → Amplify → Money → Validate → (flip)**.

Detector rules are named after the FTC's dark-pattern taxonomy where a regulatory name exists
(Baseless Countdown Timer, False Low Stock Message, False Activity Messages…), and every rule carries
its evidence citation into the scan output. Pure regex core — same input, same verdict. No LLM, no
network calls beyond fetching the page you point it at.

## Run

```sh
bun test                 # 6 tests
bun run start            # API on :4242 (PORT env to override)
bun run bin/fomoscan.ts <url|file.html|->   # CLI
```

## API

- `POST /scan` with `{"url": …}` or `{"html": …}` or `{"text": …}` (also `GET /scan?url=…`)
  → `{ score: 0-100, verdict, stages[], receipts[{match, context, bias, ref}], … }`
- `GET /manual` — the framework as machine-readable data (stages, tells, countermeasures, evidence)
- `GET /honeypot` — a deliberately dark-patterned test page (scores 100)

## Scoring

Per-rule hits (deduped, capped) × weight, with a diversity bonus when ≥3 distinct stages fire —
one lonely "Bestseller" badge is ambient; countdown + stock counter + activity feed + crowd appeal
is the loop. Bands: 0 clean · <20 ambient · <45 warming · <70 running · ≥70 full FOMOENGINE.

## Known limitations

- Client-side-rendered urgency is invisible to a static fetch (booking.com scores clean because its
  "only 2 rooms left" arrives via JS). A headless-browser fetcher would close this gap.
- Bot-walled sites (403) can't be scanned server-side — pipe saved HTML to the CLI instead.
- English-language patterns only, v0.1.

## Live deployments

- **API**: https://api.fomoengine.io (Fly app `fomoengine`, lhr, auto-stop — try `/honeypot`, it scores 100;
  fomoengine.fly.dev remains an alias). The fomoengine.io apex hosts the sibling product — the
  "authenticity shield" manipulation decoder for humans (Vercel) — so the apex stays put and agents
  live at `api.`
- **agenttool marketplace**: listing `fomo-scan 驚執輸檢測` (`402e833c-5dba-48d7-a95e-d5eb7d1bf569`,
  10 GBP-minor) — an anti-FOMO scanner sold on an agent marketplace, which is the correct amount of
  irony. Fulfilled by the shared seller loop; full escrow→scan→sealed-delivery→release drill green
  2026-07-10. The launch drill also surfaced and fixed a latent marketplace-wide input-unsealing bug,
  so it paid for itself before earning a penny.
- **Field manual** (the research behind the rules): 78 claims through 3-lens adversarial verification,
  0 refuted — served as data at `/manual`.
