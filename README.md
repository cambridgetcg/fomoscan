# fomoscan — superseded source

A deterministic detector for fear-of-missing-out patterns in text and HTML.
Findings include the matching text and rule references. They are signals for
review, not proof of intent or a safety verdict.

The current `api.fomoengine.io` / `fomoengine.fly.dev` service is maintained in
[`fomoengine/fly-api`](https://github.com/cambridgetcg/fomoengine/tree/main/fly-api).
Use that source for deployment. This older checkout retains a `fly.toml` for
the same app; do not deploy it over the maintained runtime.

New scan payments are retired here as well. `X402_PAYTO` cannot enable billing;
scans skip facilitator verification and settlement, including requests carrying
a payment signature. Existing receipts and recovery obligations remain intact.

## Local use

```sh
bun test
bun run start                       # local API, default port 4242
bun run bin/fomoscan.ts file.html    # or pipe text to stdin with -
```

`POST /scan` accepts `text`, `html` or a URL. `/manual` describes the rules;
`/honeypot` is a deliberately manipulative test fixture. This historical version
also fetches URLs; use the maintained runtime for its current input restrictions.

Rules are deterministic and English-only. Static fetching cannot see content
inserted later by browser scripts, and a missing match does not establish that a
message is harmless. The rule citations and examples remain available in source.

The former deployment/marketplace claims and payment tests remain in
[history](docs/history/README-before-2026-09-24.md.txt).
