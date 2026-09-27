# Threat model

This is what toolprivacy is actually defending against, stated plainly so you
can decide whether it fits your situation. It is short on purpose. If the gate
ever claims more than this, the claim is wrong.

## Primary scenario: accidental purpose-bound leakage in a benign agent

The agent is **not** an adversary. It is trying to help you. It fetched a piece
of your data for one task (say, an email address to send a calendar invite),
that data is now sitting in its context, and a few turns later — while writing
something unrelated, like a weekly summary — it helpfully drops that same value
into the new output.

Nothing crashed. Nothing was malicious. The data was fetched for purpose A and
quietly flowed into purpose B. That is the leak this gate is built to catch: a
value crossing from the purpose it was bound to into a sink whose purpose is not
compatible with it.

The gate runs once, deterministically, on the drafted outbound before it ships,
and flags the mismatch.

## What the gate trusts

The gate is given three things: the tool results (each carrying a **declared
purpose** for why the data was fetched), the **drafted outbound** content about
to be sent, and the purpose attached to each outbound sink. It trusts those
declared purpose labels. It does not verify that a declared purpose is honest,
and it does not infer intent. It checks the declared purpose of a value against
the observed purpose of the sink it appears in, and nothing more.

So the gate is only as trustworthy as the purpose labels feeding it. In the
benign-agent scenario that is a reasonable assumption: the agent has no reason
to lie about why it fetched something. In an adversarial scenario it is not, and
that is why the cases below are out of scope.

## Out of current scope (named, not hidden)

These are real threats. The gate does not claim to handle them today. They are
written here so nobody mistakes the boundary for coverage.

- **A prompt-injection adversary actively trying to exfiltrate.** If a malicious
  instruction convinces the agent to mislabel a sink's purpose, or to fetch data
  under a purpose it then deliberately reuses, the gate is reading attacker-
  controlled labels and will trust them. Defending the integrity of the purpose
  labels themselves is a separate problem from catching accidental flow.
- **A malicious tool.** The gate trusts the declared purpose a tool reports. A
  tool that lies about why it returned data, or smuggles data through an
  unexpected field, is outside the trust boundary.
- **Semantic or paraphrased leaks.** Detection is literal and digit-normalized.
  If the agent restates the secret in different words rather than reproducing the
  value, the gate does not catch it. The measured coverage on paraphrase is low,
  and that number is reported honestly rather than papered over.

## Future work

The out-of-scope items are the honest edges of the 0.0.1 claim, not a denial
that they matter. Hardening purpose-label integrity against injection, and
moving beyond literal detection toward semantic coverage, are the named next
iterations. Until then the claim stands only inside the boundary above:
accidental purpose-bound leakage, in a benign agent, with trusted purpose
labels.
