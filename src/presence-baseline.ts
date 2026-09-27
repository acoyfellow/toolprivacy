import { PRIVATE_CLASSES, type PrivateClass } from './policy.js';
import type { GateInput, SinkContent } from './types.js';

function classify(value: string): PrivateClass | null {
  for (const cls of PRIVATE_CLASSES) {
    if (!cls.detector.test(value)) continue;
    if (cls.validate && !cls.validate(value)) continue;
    return cls;
  }
  return null;
}

function contentToString(content: SinkContent): string {
  if (typeof content === 'string') return content;
  if (content === null || typeof content === 'number' || typeof content === 'boolean') {
    return '';
  }
  if (Array.isArray(content)) return content.map(contentToString).join(' ');
  return Object.values(content as { readonly [k: string]: SinkContent })
    .map(contentToString)
    .join(' ');
}

export interface PresenceHit {
  readonly sinkId: string;

  readonly fieldPath: string;

  readonly privateClass: string;
}

export interface PresenceVerdict {

  readonly flagged: boolean;
  readonly hits: readonly PresenceHit[];
  readonly scanned: {
    readonly sinks: number;
    readonly trackedFields: number;
  };
}

export function presenceCheck(input: GateInput): PresenceVerdict {
  const tracked: { fieldPath: string; privateClass: string; value: string }[] = [];
  for (const tr of input.toolResults) {
    for (const [field, raw] of Object.entries(tr.fields)) {
      const cls = classify(raw);
      if (!cls) continue;
      tracked.push({ fieldPath: `${tr.toolName}.${field}`, privateClass: cls.id, value: raw });
    }
  }

  const hits: PresenceHit[] = [];
  for (const sink of input.outbound) {
    const lc = contentToString(sink.content).toLowerCase();
    for (const t of tracked) {
      if (lc.includes(t.value.toLowerCase())) {
        hits.push({ sinkId: sink.sinkId, fieldPath: t.fieldPath, privateClass: t.privateClass });
      }
    }
  }

  return {
    flagged: hits.length > 0,
    hits,
    scanned: { sinks: input.outbound.length, trackedFields: tracked.length },
  };
}
