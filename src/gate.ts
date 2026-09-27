import {
  POLICY_VERSION,
  PRIVATE_CLASSES,
  type PrivateClass,
  PURPOSE_COMPATIBILITY,
  PURPOSE_TAXONOMY,
  type Purpose,
} from './policy.js';
import type { GateInput, SinkContent, Verdict, Violation } from './types.js';

function isKnownPurpose(p: string): p is Purpose {
  return (PURPOSE_TAXONOMY as readonly string[]).includes(p);
}

function classify(value: string): PrivateClass | null {
  for (const cls of PRIVATE_CLASSES) {
    if (!cls.detector.test(value)) continue;
    if (cls.validate && !cls.validate(value)) continue;
    return cls;
  }
  return null;
}

interface Tracked {
  readonly fieldPath: string;
  readonly privateClass: string;
  readonly boundPurpose: string;
  readonly value: string;
  readonly normalize?: ((s: string) => string) | undefined;
}

function appearsIn(value: string, normalize: Tracked['normalize'], content: string): boolean {
  if (content.toLowerCase().includes(value.toLowerCase())) return true;
  if (normalize) {
    const nv = normalize(value);

    if (nv.length >= 4 && normalize(content).includes(nv)) return true;
  }
  return false;
}

function collectStringLeaves(content: SinkContent): string[] {
  if (typeof content === 'string') return [content];
  if (content === null || typeof content === 'number' || typeof content === 'boolean') {
    return [];
  }
  const leaves: string[] = [];
  if (Array.isArray(content)) {
    for (const item of content) leaves.push(...collectStringLeaves(item));
  } else {
    for (const v of Object.values(content as { readonly [k: string]: SinkContent })) {
      leaves.push(...collectStringLeaves(v));
    }
  }
  return leaves;
}

function appearsInContent(
  value: string,
  normalize: Tracked['normalize'],
  content: SinkContent,
): boolean {
  for (const leaf of collectStringLeaves(content)) {
    if (appearsIn(value, normalize, leaf)) return true;
  }
  return false;
}

export function gate(input: GateInput): Verdict {

  const tracked: Tracked[] = [];
  for (const tr of input.toolResults) {
    for (const [field, raw] of Object.entries(tr.fields)) {
      const cls = classify(raw);
      if (!cls) continue;
      tracked.push({
        fieldPath: `${tr.toolName}.${field}`,
        privateClass: cls.id,
        boundPurpose: tr.declaredPurpose,
        value: raw,
        normalize: cls.normalize,
      });
    }
  }

  const violations: Violation[] = [];
  for (const sink of input.outbound) {
    for (const t of tracked) {
      if (!appearsInContent(t.value, t.normalize, sink.content)) continue;

      let reason: Violation['reason'] | null = null;
      if (!isKnownPurpose(t.boundPurpose)) {
        reason = 'unknown_bound_purpose';
      } else if (!isKnownPurpose(sink.purpose)) {
        reason = 'unknown_sink_purpose';
      } else {
        const allowed = PURPOSE_COMPATIBILITY[t.boundPurpose as Purpose] ?? [];
        if (!allowed.includes(sink.purpose as Purpose)) {
          reason = 'purpose_mismatch';
        }
      }

      if (reason) {
        violations.push({
          sinkId: sink.sinkId,
          sinkKind: sink.kind,
          fieldPath: t.fieldPath,
          privateClass: t.privateClass,
          boundPurpose: t.boundPurpose,
          observedPurpose: sink.purpose,
          reason,
        });
      }
    }
  }

  let verdict: Verdict['verdict'];
  if (violations.length > 0) {
    verdict = 'leak';
  } else if (input.outbound.length === 0) {
    verdict = 'inconclusive';
  } else {
    verdict = 'pass';
  }

  return {
    verdict,
    violations,
    scanned: { sinks: input.outbound.length, trackedFields: tracked.length },
    policyVersion: POLICY_VERSION,
  };
}

export { POLICY_VERSION };
