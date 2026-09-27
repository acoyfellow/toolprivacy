# experiments

Self-contained, runnable experiments — one per angle (auth-research shape).

The gate's behavioral checks live in `../test/gate.test.ts` (it is small enough
that its checks fit there). Experiments that need their own harness land here as
the notebook grows:

- `live-wire/` — drive a real tool-using LLM and run `gate()` on its actual tool
  results + outbound content (currently unproven; see `status.json`).
- `detector-falsepos/` — measure detector false-positive rate on free-text PII.
- `gen-ui-dogfood` — REALIZED as `../app/` (builds; consumes the shipped gate; see `receipts/04`). The `@cloudflare/gen-ui` package itself remains unproven (`findings.md` Feedback #1).
