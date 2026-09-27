export interface Violation {
  readonly sinkId: string;
  readonly sinkKind: 'user_message' | 'tool_call' | 'log';
  readonly fieldPath: string;
  readonly privateClass: string;
  readonly boundPurpose: string;
  readonly observedPurpose: string;
  readonly reason: 'purpose_mismatch' | 'unknown_sink_purpose' | 'unknown_bound_purpose';
}

export interface Verdict {
  readonly verdict: 'pass' | 'leak' | 'inconclusive';
  readonly violations: readonly Violation[];
  readonly scanned: { readonly sinks: number; readonly trackedFields: number };
  readonly policyVersion: string;
}
