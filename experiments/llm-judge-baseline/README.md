# experiments/llm-judge-baseline (E6 Part B)

**Honest framing of the obvious alternative: "just ask an LLM to judge the final
output."**

This is a *conceptual* comparison, not a benchmark run. We do **not** call a real
model here. The point is to state — plainly and without spin — where an LLM-judge
baseline would beat toolprivacy and, more importantly, where it would *lose*, so
the project's own claim stays honest.

## The two checkers being compared

**LLM-judge baseline.** Take the agent's final, drafted output (and optionally the
tool transcript) and ask a model: *"Does this response leak private data it should
not?"* Use the model's free-text / structured answer as the gate.

**toolprivacy (`src/gate.ts`).** A pure, synchronous function. It classifies the
private atoms each tool returned (with a declared purpose), then flags any atom
that appears in an outbound sink whose purpose is not compatible with the atom's
bound purpose — before the response ships. Zero model calls. The verdict carries
only structural metadata (field path, data class, bound vs. observed purpose,
reason): no raw value, no value-derived token.

## Property comparison

| Property | LLM-judge baseline | toolprivacy gate |
| --- | --- | --- |
| **Determinism** | Non-deterministic. Same input can yield different verdicts across runs / temperatures / model versions. No byte-identical verdict guarantee. | Deterministic. Same input → byte-identical verdict, every time (asserted over 50 runs in the test suite, incl. structured content). |
| **Leak-safety of the checker itself** | Can itself leak. The judge's reasoning/explanation can quote the secret back ("the response leaked `alice@…`"), and that text is now logged/stored. The checker becomes a new exfiltration surface. | Never leaks. The verdict provably carries no raw value and no value-derived token (no hash/fingerprint) — there is nothing in it to invert. Asserted by the SAFETY INVARIANT / NON-REVERSIBILITY tests. |
| **Latency** | A model round-trip per check (tens to thousands of ms; network-bound, variable tail). | Microseconds. Pure in-process function; no I/O. |
| **Cost** | Per-call token cost; scales with transcript size and check frequency. | Zero marginal cost. No tokens, no API. |
| **Purpose-binding** | None intrinsic. Judges "does this look like a leak?" — it has no model of *which purpose a value was fetched for*, so it cannot tell a legitimate in-purpose use from an out-of-purpose leak unless you engineer that into the prompt (and even then, non-deterministically). | First-class. The whole mechanism is bound-purpose vs. sink-purpose compatibility (`PURPOSE_COMPATIBILITY`). The benign in-purpose use and the leak are byte-identical in presence; only purpose-binding separates them. |
| **Coverage — literal / digit-normalized leak** | High (PROJECTED, not measured here). | High (MEASURED in suite: literal + digit-normalized presence is caught). |
| **Coverage — paraphrase / encoding / split / word-substitution** | Likely **higher recall** (PROJECTED). A model can plausibly catch base64, "at"/"dot" substitution, zero-width interleaving, paraphrase. | Documented **known gap** (MEASURED as `pass` in the suite's KNOWN-GAPS block). toolprivacy does not decode/canonicalize/reassemble — by design, stated honestly. |
| **False-positive behavior** | Variable; depends on prompt + model. Can hallucinate leaks or miss them. | Deterministic and inspectable. Luhn validation suppresses the order-ID-as-PAN false positive (MEASURED). |
| **Auditability** | Verdict is prose; not stable; hard to diff or regression-test. | Closed-set label + structured violations; trivially diffable, regression-tested, safe to log/store. |
| **Failure mode** | Fails *open and noisily*: a wrong/jailbroken judge can pass a real leak, or its explanation can leak. | Fails *closed*: unknown purpose carrying a tracked value is flagged; no outbound → `inconclusive` (never a false "pass"). |

## The tradeoff, stated plainly

The LLM judge **likely has higher paraphrase/encoding recall** — that is a real
advantage and we do not hide it. But it is **non-deterministic, adds latency and
cost, and can itself leak the secret in its reasoning.** It is a checker you cannot
fully trust to be safe or repeatable.

toolprivacy is the **reliable baseline**: it never lies (deterministic, inspectable)
and it never leaks (the verdict has no secret-derived bits). Its recall on
paraphrase/encoding is a stated, measured known gap — not a surprise.

The honest conclusion: **these are complementary, not interchangeable.** A robust
deployment would run the deterministic, non-leaking gate as the always-on,
byte-stable floor, and *optionally* layer an LLM judge for higher paraphrase recall
— while accepting that the judge is the part that can be wrong and can leak, and so
must be sandboxed (its reasoning never logged in the clear).

## What is measured vs. projected in this experiment

- **Measured (in `../../test/gate.test.ts`, run via `bun test`):** toolprivacy's
  determinism (50-run byte-identical), leak-safety / non-reversibility of the
  verdict, literal + digit-normalized recall, the Luhn false-positive control, and
  the documented known gaps (encoding/paraphrase/split → `pass`).
- **Projected (NOT measured here):** every claim about the LLM judge's recall,
  latency, cost, and leak behavior. No model was called. These are reasoned
  expectations, labeled as such, to keep the comparison honest. Turning them into
  measured numbers would require a real model harness and a labeled corpus —
  a named future iteration.

See `../../receipts/10-llm-judge-comparison.json`.
