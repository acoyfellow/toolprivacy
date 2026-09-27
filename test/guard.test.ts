import { describe, expect, test } from 'bun:test';
import { guardReply } from '../src/guard.js';
import type { ToolResult } from '../src/types.js';

const PLANTED_EMAIL = 'alice.planted@example.invalid';

const fetchedForInvite: ToolResult[] = [
  {
    toolCallId: 'tc-1',
    toolName: 'getContact',
    declaredPurpose: 'send_calendar_invite',
    fields: { email: PLANTED_EMAIL },
  },
];

describe('guardReply: drop-in pre-ship gate', () => {
  test('leak draft (email out of purpose) -> allow:false', () => {
    const { allow, verdict } = guardReply({
      toolResults: fetchedForInvite,
      draftReply: `Here's your week. I also spotted ${PLANTED_EMAIL} in your contacts.`,
      sinkPurpose: 'general_summary',
    });
    expect(allow).toBe(false);
    expect(verdict.verdict).toBe('leak');
    expect(verdict.violations).toHaveLength(1);
    expect(verdict.violations[0]!.reason).toBe('purpose_mismatch');
  });

  test('benign draft (no tracked value present) -> allow:true', () => {
    const { allow, verdict } = guardReply({
      toolResults: fetchedForInvite,
      draftReply: "I've set up your 3pm sync. Anything else?",
      sinkPurpose: 'answer_user_question',
    });
    expect(allow).toBe(true);
    expect(verdict.verdict).toBe('pass');
    expect(verdict.violations).toHaveLength(0);
  });

  test('in-purpose draft (email used in the invite sink) -> allow:true', () => {
    const { allow, verdict } = guardReply({
      toolResults: fetchedForInvite,
      draftReply: `{"to":"${PLANTED_EMAIL}","title":"Sync","time":"2026-07-01T15:00Z"}`,
      sinkPurpose: 'send_calendar_invite',
      sinkKind: 'tool_call',
    });
    expect(allow).toBe(true);
    expect(verdict.verdict).toBe('pass');
  });

  test('SAFETY: the returned verdict never echoes the raw secret', () => {
    const { verdict } = guardReply({
      toolResults: fetchedForInvite,
      draftReply: `leak ${PLANTED_EMAIL}`,
      sinkPurpose: 'general_summary',
    });
    const serialized = JSON.stringify(verdict);
    expect(serialized).not.toContain(PLANTED_EMAIL);
    expect(serialized).not.toContain('alice.planted');
  });

  test('fail-closed: an unknown sink purpose carrying the value -> allow:false', () => {
    const { allow, verdict } = guardReply({
      toolResults: fetchedForInvite,
      draftReply: PLANTED_EMAIL,
      sinkPurpose: 'exfiltrate_everything',
      sinkKind: 'tool_call',
    });
    expect(allow).toBe(false);
    expect(verdict.violations[0]!.reason).toBe('unknown_sink_purpose');
  });

  test('default sink id/kind are applied when omitted', () => {
    const { verdict } = guardReply({
      toolResults: fetchedForInvite,
      draftReply: `leak ${PLANTED_EMAIL}`,
      sinkPurpose: 'general_summary',
    });
    expect(verdict.violations[0]!.sinkId).toBe('draft_reply');
    expect(verdict.violations[0]!.sinkKind).toBe('user_message');
  });
});
