import { gate } from './gate.js';
import type { Purpose } from './policy.js';
import type { GateInput, OutboundSink, ToolResult, Verdict } from './types.js';

export interface GuardReplyInput {

  readonly toolResults: readonly ToolResult[];

  readonly draftReply: string;

  readonly sinkPurpose: Purpose | string;

  readonly sinkKind?: OutboundSink['kind'];

  readonly sinkId?: string;
}

export interface GuardResult {

  readonly allow: boolean;

  readonly verdict: Verdict;
}

export function guardReply(input: GuardReplyInput): GuardResult {
  const gateInput: GateInput = {
    toolResults: input.toolResults,
    outbound: [
      {
        sinkId: input.sinkId ?? 'draft_reply',
        kind: input.sinkKind ?? 'user_message',
        purpose: input.sinkPurpose,
        content: input.draftReply,
      },
    ],
  };
  const verdict = gate(gateInput);
  return { allow: verdict.verdict === 'pass', verdict };
}
