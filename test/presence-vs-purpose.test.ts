import { describe, expect, test } from 'bun:test';
import { gate } from '../src/gate.js';
import { presenceCheck } from '../src/presence-baseline.js';
import type { GateInput, ToolResult } from '../src/types.js';

const EMAIL = 'casey.demo@example.invalid';

const fetchedForInvite: ToolResult[] = [
  {
    toolCallId: 'tc-1',
    toolName: 'getContact',
    declaredPurpose: 'send_calendar_invite',
    fields: { email: EMAIL },
  },
];

const benignInPurpose: GateInput = {
  toolResults: fetchedForInvite,
  outbound: [
    {
      sinkId: 'sink-invite',
      kind: 'tool_call',
      purpose: 'send_calendar_invite',
      content: `{"to":"${EMAIL}","title":"Sync","time":"2026-07-01T15:00Z"}`,
    },
  ],
};

const outOfPurposeLeak: GateInput = {
  toolResults: fetchedForInvite,
  outbound: [
    {
      sinkId: 'sink-summary',
      kind: 'user_message',
      purpose: 'general_summary',
      content: `Here's your week. I also noticed ${EMAIL} in your contacts.`,
    },
  ],
};

describe('before/after: presence-only baseline CANNOT distinguish purpose', () => {
  test('baseline flags the BENIGN in-purpose use (false positive)', () => {
    const p = presenceCheck(benignInPurpose);
    expect(p.flagged).toBe(true);
    expect(p.hits).toHaveLength(1);
  });

  test('baseline flags the OUT-OF-PURPOSE leak (true positive)', () => {
    const p = presenceCheck(outOfPurposeLeak);
    expect(p.flagged).toBe(true);
  });

  test('baseline verdicts are IDENTICAL for benign and leak -> it cannot tell them apart', () => {
    const a = presenceCheck(benignInPurpose).flagged;
    const b = presenceCheck(outOfPurposeLeak).flagged;
    expect(a).toBe(b);
  });
});

describe('before/after: purpose-binding gate DISTINGUISHES them', () => {
  test('gate PASSES the benign in-purpose use', () => {
    const v = gate(benignInPurpose);
    expect(v.verdict).toBe('pass');
    expect(v.violations).toHaveLength(0);
  });

  test('gate CATCHES the out-of-purpose leak', () => {
    const v = gate(outOfPurposeLeak);
    expect(v.verdict).toBe('leak');
    expect(v.violations[0]!.reason).toBe('purpose_mismatch');
  });

  test('THE CONTRAST: gate verdicts DIFFER (pass vs leak) where the baseline was identical', () => {
    const gateA = gate(benignInPurpose).verdict;
    const gateB = gate(outOfPurposeLeak).verdict;
    expect(gateA).not.toBe(gateB);
    expect(gateA).toBe('pass');
    expect(gateB).toBe('leak');

    expect(presenceCheck(benignInPurpose).flagged).toBe(presenceCheck(outOfPurposeLeak).flagged);
  });
});
