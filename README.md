# toolprivacy

**A deterministic gate that catches purpose-bound privacy leaks in tool-using LLM agents — before the response ships.**

`0.0.1`, private. A notebook, not yet a repo. Inspired by *ToolPrivacyBench: Benchmarking Purpose-Bound Privacy in Tool-Using LLM Agents* (cs.CR/cs.AI).

---

## The pain

A tool-using agent fetches your contact's email **to send a calendar invite**. That email is now sitting in the agent's context. Two turns later the agent writes you a breezy weekly summary and — helpfully — drops the address into it:

> "Here's your week. I also noticed alice@example.invalid in your contacts."

Nothing crashed. No error fired. The data was fetched for one purpose (`send_calendar_invite`) and quietly **flowed into a different one** (`general_summary`). That is a purpose-bound privacy leak, and an LLM judge that grades the final text is both expensive and non-deterministic — a bad referee for a security boundary.

## The promise

One pure, synchronous function decides — deterministically, before anything ships:

> Given each tool call's **declared purpose**, the data it returned, and the agent's **outbound content**, flag any purpose-bound private value whose **literal or digit-normalized presence** is detected in a sink whose purpose is not compatible with the value's bound purpose.

Detection is literal + digit-normalized only; see **Limits** for the exact scope and known gaps.

And it does it without ever re-leaking the secret: the verdict is a closed-set label plus the offending **field path / data class / bound vs. observed purpose / reason** — and **no value-derived token at all** (no hash, no fingerprint). Because nothing in the verdict depends on the secret's bits, the verdict is **provably non-reversible** (a credential-leak-guard technique).

## Quick start

```bash
bun install
bun test        # 16/16 green: planted leak caught, benign use passes, verdict carries no secret,
                # false-positive control (order ID ≠ card), and KNOWN-GAP limits documented
```

Use it in ~10 lines:

```ts
import { gate } from './src/index.js';

const verdict = gate({
  toolResults: [
    {
      toolCallId: 'tc-1',
      toolName: 'getContact',
      declaredPurpose: 'send_calendar_invite', // why the agent fetched it
      fields: { email: 'alice@example.invalid' },
    },
  ],
  outbound: [
    {
      sinkId: 'sink-summary',
      kind: 'user_message',
      purpose: 'general_summary', // a DIFFERENT purpose
      content: 'Here is your week. I also noticed alice@example.invalid.',
    },
  ],
});

// { verdict: 'leak', violations: [{ fieldPath: 'getContact.email',
//   privateClass: 'email_address', boundPurpose: 'send_calendar_invite',
//   observedPurpose: 'general_summary', reason: 'purpose_mismatch' }], ... }
//   ^ no raw email, and no value-derived token (no fingerprint/hash) anywhere
```

Flip the sink purpose to `send_calendar_invite` (use it *in* the invite) and the same value passes clean.

## Dogfood app (`app/`)

An AX-branded **React + Cloudflare Worker** surface that consumes the gate and renders **as generative UI** (the `@cloudflare/gen-ui` consumption pattern: model JSX becomes UI-JSON, then renders against an own React catalog).

The dogfood goes deeper than the verdict now: the **whole explainer page** — the plain what/why/how intro, the same-value/two-outcomes before/after walkthrough, the "how you'd call it" snippet, and the flow/schema explainer — is authored as **one UI-JSON tree** (`app/src/page-ui.ts`) and rendered through the same `renderUI(catalog)` path as the live verdict. The live verdict subtree (`app/src/verdict-to-ui.ts`) is embedded as a child, so there is exactly one rendering path for static copy and live output alike. A **"view the UI-JSON" toggle** dumps the current tree on screen to prove it is data-driven, not hand-placed JSX. The Worker runs the *real* shipped gate on `POST /api/gate`; internal terms are translated to plain labels at the boundary (`boundPurpose` becomes "fetched for", `observedPurpose` becomes "used in", the policy version is a "ruleset"), so no unexplained jargon reaches the first screen.

The catalog (`app/src/catalog.tsx`) grew the components this required: `Hero`, `Section`, `Step`, `BeforeAfter`, `CodeBlock`, `Callout`, `FlowDiagram`, `Legend`, `JsonView`, and a `ScenarioPicker` whose behavior is supplied via React context (`scenario-context.ts`) so the UI-JSON stays pure, serializable data.

```bash
cd app
bun install
bun run build     # tsc --noEmit + vite build → dist/ (also typechecks the Worker)
```

PWA baseline (web manifest, service worker, offline fallback) and SEO baseline (title/meta/OG, `sitemap.xml`, `robots.txt`, JSON-LD) are included and land in `dist/`.

> **gen-ui caveat (honest):** `@cloudflare/gen-ui` could not be resolved from the registry (404, while sibling `@cloudflare/*` packages resolve), so `app/src/genui/` is a small **local adapter** mirroring its *documented* contract. Real consumption of the package is tracked as `unproven` in `status.json`; the friction is written up in `findings.md` (Feedback #1–#4).

## Proof

- `bun test` runs the headline pair (`test/gate.test.ts`):
  - **RED-BEFORE-GREEN** — the planted invite-email leak is *caught*.
  - the benign in-purpose use *passes*.
- Mechanical red-to-green is in the receipt: disabling the purpose-mismatch check turns the planted-leak tests RED; restoring it returns the suite GREEN. See `receipts/01-planted-leak-caught.json`.
- A recorded negative result proves substring-presence-only detection is *not* enough — only purpose-binding separates benign use from a leak. See `receipts/02-substring-only-insufficient.json`.
- A **second** recorded negative result bounds the old fingerprint: an unkeyed 32-bit fingerprint is **not** non-reversible — it was brute-forced. The fix (dropping the fingerprint) and a non-reversibility test are in `receipts/05-fingerprint-reversible.json`.
- **Honest about its gaps:** the `KNOWN GAPS` block in `test/gate.test.ts` contains tests for base64/hex/word-split/zero-width/split-across-sinks that assert the gate's *current* `pass` behavior and are labeled as documented limits — the suite documents what it cannot yet catch rather than pretending it can.
- The full ledger of what is proven / unproven / disproven lives in `status.json`.

## How it works

```text
tool calls (each with a DECLARED purpose)        outbound sinks (each with a purpose)
        │                                                  │
        ▼                                                  ▼
  classify fields by deterministic detector       scan content for LITERAL +
  (email / phone / card[Luhn] / ssn)               DIGIT-NORMALIZED presence of
        → tracked set                       ─────► tracked values; purpose compatible? (policy.ts)
                                                           │
                                                           ▼
                              closed-set Verdict: pass | leak | inconclusive
                              violations carry field + class + purpose + reason — NO value-derived token
```

The load-bearing primitive is `gate()` in `src/gate.ts`: pure, synchronous, zero-dependency, byte-identical across repeated runs.

## Threat model

The full version lives in [`docs/threat-model.md`](docs/threat-model.md); the short of it:

- **Primary scenario:** accidental purpose-bound leakage in a *benign* agent. It fetched your data for task A, then helpfully included it in unrelated output B. No malice, nothing crashed — the value just crossed from the purpose it was bound to into an incompatible one. That is what the gate catches.
- **Trust assumption:** the gate sees the tool results, the drafted outbound, and the declared purpose labels, and it trusts those labels. It does not verify that a declared purpose is honest, and it does not infer intent.
- **Out of current scope (named, not hidden):** a prompt-injection adversary actively trying to exfiltrate, a malicious tool that lies about its declared purpose, and semantic or paraphrased leaks where the agent restates the secret in different words. These are real threats the gate does not handle today; they are written down as known limits and future work, not coverage.

## What it deliberately does not do (limits)

- **Detection is literal + digit-normalized only.** It does **not** decode base64/hex/url-encoding, undo word-substitution (`a at b dot com`), strip zero-width/homoglyph characters, or reassemble a value **split across two sinks** (each sink is scanned whole). These are exercised as explicit `KNOWN GAPS` tests and tracked under `status.json.unproven` as a named future iteration ("encoding/canonicalization coverage"). The claim is **conditional on this scope**.
- **Not** a model or an LLM judge. It does not infer intent; it checks *declared* purpose against *observed* sink purpose.
- It only tracks values that match a detector (`email_address`, `phone_number`, `payment_card` (Luhn-validated), `us_ssn`). Free-text PII (names, prose addresses) is **out of scope** in 0.0.1 and recorded as unproven. `payment_card` requires a Luhn-valid 13-19 digit run, so order IDs / arbitrary digit runs are not flagged as cards.
- It does not *prevent* the leak; it *flags* it. Wiring the verdict to a block/redact action is the caller's job.
- It does not verify that `declaredPurpose` is honest — who declares purpose, and how it is bound at call time, is an open question in `status.json`.
- It is not yet proven on a real agent wire; current proof is hand-built `GateInput` fixtures.
- The verdict carries **no value-derived token** (no fingerprint/hash). Two receipts therefore cannot be correlated by value — a deliberate trade vs. the old (reversible) fingerprint.

## Where to edit behavior

One file: **`src/policy.ts`**.

- `PRIVATE_CLASSES` — what a private value looks like (deterministic detectors).
- `PURPOSE_TAXONOMY` — the closed set of allowed purposes.
- `PURPOSE_COMPATIBILITY` — which sink purposes a value fetched for purpose *P* may flow into. Default is strict self-binding; anything not listed (including unknown purposes) fails closed.

## What this makes possible next (leverage)

The mechanism, not a badge — separated into projected vs. realized in the receipts.

- **Projected:** a pre-ship privacy gate that any tool-using agent can call, expressed as a `goodput` outcome (intent, execution, evidence, verified constraint cleared) and emitted in the `proof-spec` shape, so the rest of the portfolio can read its receipts directly. If it holds against a real wire, it folds into **My AX** as a reusable gate beside `gateproof`/`mergegate`.
- **Projected:** a deterministic, cheap referee that ToolPrivacyBench-style evals can call instead of (or before) an LLM judge — the strong referee the repo shape demands before scaling volume.
- **Realized (partial):** the dogfood Worker (`app/worker/index.ts`) reuses the *shipped* gate unchanged and renders its verdict as generative UI — in-repo second-artifact reuse, recorded in `receipts/04-reusable-hammer-realization.json`. Full realization (a *separate* notebook citing the schema) is still open.

## License

MIT. See `LICENSE`.
