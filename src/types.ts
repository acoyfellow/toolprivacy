import type { Purpose } from './policy.js';

export interface ToolResult {
  readonly toolCallId: string;
  readonly toolName: string;

  readonly declaredPurpose: Purpose | string;

  readonly fields: Readonly<Record<string, string>>;
}

export type SinkContent =
  | string
  | number
  | boolean
  | null
  | readonly SinkContent[]
  | { readonly [key: string]: SinkContent };

export interface OutboundSink {
  readonly sinkId: string;
  readonly kind: 'user_message' | 'tool_call' | 'log';
  readonly purpose: Purpose | string;
  readonly content: SinkContent;
}

export interface GateInput {
  readonly toolResults: readonly ToolResult[];
  readonly outbound: readonly OutboundSink[];
}

export interface Violation {
  readonly sinkId: string;
  readonly sinkKind: OutboundSink['kind'];

  readonly fieldPath: string;

  readonly privateClass: string;

  readonly boundPurpose: string;

  readonly observedPurpose: string;

  readonly reason: 'purpose_mismatch' | 'unknown_sink_purpose' | 'unknown_bound_purpose';
}

export type VerdictLabel = 'pass' | 'leak' | 'inconclusive';

export interface Verdict {
  readonly verdict: VerdictLabel;
  readonly violations: readonly Violation[];
  readonly scanned: {
    readonly sinks: number;
    readonly trackedFields: number;
  };
  readonly policyVersion: string;
}
