import { describe, expect, test } from 'bun:test';
import { gate } from '../src/gate.js';
import type { GateInput } from '../src/types.js';

const PLANTED_EMAIL = 'alice.planted@example.invalid';

describe('north-star: planted purpose-bound leak is caught before ship', () => {

  const leakInput: GateInput = {
    toolResults: [
      {
        toolCallId: 'tc-1',
        toolName: 'getContact',
        declaredPurpose: 'send_calendar_invite',
        fields: { email: PLANTED_EMAIL },
      },
    ],
    outbound: [
      {
        sinkId: 'sink-summary',
        kind: 'user_message',
        purpose: 'general_summary',
        content: `Here is a summary of your week. I also noticed ${PLANTED_EMAIL} in your contacts.`,
      },
    ],
  };

  test('RED-BEFORE-GREEN: the planted leak is CAUGHT', () => {
    const v = gate(leakInput);
    expect(v.verdict).toBe('leak');
    expect(v.violations).toHaveLength(1);
    const violation = v.violations[0]!;
    expect(violation.fieldPath).toBe('getContact.email');
    expect(violation.privateClass).toBe('email_address');
    expect(violation.boundPurpose).toBe('send_calendar_invite');
    expect(violation.observedPurpose).toBe('general_summary');
    expect(violation.reason).toBe('purpose_mismatch');
  });

  test('SAFETY INVARIANT: the verdict echoes neither the raw secret nor any value-derived token', () => {
    const v = gate(leakInput);
    const serialized = JSON.stringify(v);
    expect(serialized).not.toContain(PLANTED_EMAIL);
    expect(serialized).not.toContain('alice.planted');

    const violation = v.violations[0]!;
    expect(violation).not.toHaveProperty('fingerprint');
    expect(JSON.stringify(violation)).not.toContain('fnv1a');
    expect(Object.keys(violation).sort()).toEqual(
      [
        'boundPurpose',
        'fieldPath',
        'observedPurpose',
        'privateClass',
        'reason',
        'sinkId',
        'sinkKind',
      ].sort(),
    );
  });

  test('NON-REVERSIBILITY: the verdict is identical for two DIFFERENT secrets of the same class/flow', () => {

    const mk = (email: string): GateInput => ({
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getContact',
          declaredPurpose: 'send_calendar_invite',
          fields: { email },
        },
      ],
      outbound: [
        {
          sinkId: 'sink-summary',
          kind: 'user_message',
          purpose: 'general_summary',
          content: `Summary including ${email}.`,
        },
      ],
    });
    const a = JSON.stringify(gate(mk('alice.planted@example.invalid')));
    const b = JSON.stringify(gate(mk('znetherton.qx@example.invalid')));
    expect(a).toBe(b);
  });
});

describe('benign in-purpose use passes', () => {
  test('email fetched for the invite, then used IN the invite, PASSES', () => {
    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getContact',
          declaredPurpose: 'send_calendar_invite',
          fields: { email: PLANTED_EMAIL },
        },
      ],
      outbound: [
        {
          sinkId: 'sink-invite',
          kind: 'tool_call',
          purpose: 'send_calendar_invite',
          content: `{"to":"${PLANTED_EMAIL}","title":"Sync","time":"2026-07-01T15:00Z"}`,
        },
      ],
    };
    const v = gate(input);
    expect(v.verdict).toBe('pass');
    expect(v.violations).toHaveLength(0);
    expect(v.scanned.trackedFields).toBe(1);
  });

  test('non-private fields are not tracked and do not trip the gate', () => {
    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getWeather',
          declaredPurpose: 'general_summary',
          fields: { forecast: 'Sunny, high of 24C' },
        },
      ],
      outbound: [
        { sinkId: 's', kind: 'user_message', purpose: 'general_summary', content: 'Sunny today.' },
      ],
    };
    const v = gate(input);
    expect(v.verdict).toBe('pass');
    expect(v.scanned.trackedFields).toBe(0);
  });
});

describe('determinism', () => {
  test('same input yields byte-identical verdicts across 50 runs', () => {
    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getContact',
          declaredPurpose: 'send_calendar_invite',
          fields: { email: PLANTED_EMAIL },
        },
      ],
      outbound: [
        { sinkId: 's', kind: 'log', purpose: 'general_summary', content: `leak ${PLANTED_EMAIL}` },
      ],
    };
    const first = JSON.stringify(gate(input));
    for (let i = 0; i < 50; i++) {
      expect(JSON.stringify(gate(input))).toBe(first);
    }
  });
});

describe('fail-closed behavior', () => {
  test('unknown sink purpose carrying a tracked value is a leak', () => {
    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getContact',
          declaredPurpose: 'send_calendar_invite',
          fields: { email: PLANTED_EMAIL },
        },
      ],
      outbound: [
        {
          sinkId: 's',
          kind: 'tool_call',
          purpose: 'exfiltrate_everything',
          content: PLANTED_EMAIL,
        },
      ],
    };
    const v = gate(input);
    expect(v.verdict).toBe('leak');
    expect(v.violations[0]!.reason).toBe('unknown_sink_purpose');
  });

  test('no outbound sinks => inconclusive (gate cannot assert safety of nothing)', () => {
    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getContact',
          declaredPurpose: 'send_calendar_invite',
          fields: { email: PLANTED_EMAIL },
        },
      ],
      outbound: [],
    };
    expect(gate(input).verdict).toBe('inconclusive');
  });
});

describe('normalization catches formatting-evasion', () => {
  test('a phone number leaked with different spacing is still caught', () => {
    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getContact',
          declaredPurpose: 'send_calendar_invite',
          fields: { phone: '+1 (555) 010-1234' },
        },
      ],
      outbound: [
        {
          sinkId: 's',
          kind: 'user_message',
          purpose: 'general_summary',
          content: 'Their number is 15550101234, fyi.',
        },
      ],
    };
    const v = gate(input);
    expect(v.verdict).toBe('leak');
    expect(v.violations[0]!.privateClass).toBe('phone_number');
  });
});

describe('false-positive control (Dane R2): identifiers are not mistaken for PANs', () => {

  test('a Luhn-valid card leaked out of purpose IS flagged as payment_card', () => {
    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getWallet',
          declaredPurpose: 'book_travel',
          fields: { card: '4111 1111 1111 1111' },
        },
      ],
      outbound: [
        {
          sinkId: 's',
          kind: 'user_message',
          purpose: 'general_summary',
          content: 'For your records your card 4111111111111111 is on file.',
        },
      ],
    };
    const v = gate(input);
    expect(v.verdict).toBe('leak');
    expect(v.violations[0]!.privateClass).toBe('payment_card');
  });

  test('a 13-19 digit ORDER ID (not Luhn-valid) is NOT flagged as a payment_card', () => {

    const orderId = '1234567890123456';
    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getOrder',
          declaredPurpose: 'general_summary',
          fields: { orderId },
        },
      ],
      outbound: [
        {
          sinkId: 's',
          kind: 'user_message',
          purpose: 'general_summary',
          content: `Your order ${orderId} ships Tuesday.`,
        },
      ],
    };
    const v = gate(input);

    expect(v.scanned.trackedFields).toBe(0);
    expect(v.verdict).toBe('pass');

    expect(v.violations.find((x) => x.privateClass === 'payment_card')).toBeUndefined();
  });
});

describe('E6 Part A: structured/JSON content + multi-atom reporting', () => {
  const PLANTED_PHONE = '+1 (555) 010-1234';

  test('a JSON outbound with TWO out-of-purpose private atoms yields TWO violations', () => {

    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getContact',
          declaredPurpose: 'send_calendar_invite',
          fields: { email: PLANTED_EMAIL, phone: PLANTED_PHONE },
        },
      ],
      outbound: [
        {
          sinkId: 'sink-json',
          kind: 'tool_call',
          purpose: 'general_summary',

          content: {
            title: 'Weekly digest',
            contacts: [
              { name: 'Alice', reach: PLANTED_EMAIL },
              { name: 'Bob', meta: { mobile: PLANTED_PHONE } },
            ],
            count: 2,
            archived: false,
          },
        },
      ],
    };
    const v = gate(input);
    expect(v.verdict).toBe('leak');
    expect(v.violations).toHaveLength(2);
    const classes = v.violations.map((x) => x.privateClass).sort();
    expect(classes).toEqual(['email_address', 'phone_number']);
    const paths = v.violations.map((x) => x.fieldPath).sort();
    expect(paths).toEqual(['getContact.email', 'getContact.phone']);
    for (const violation of v.violations) {
      expect(violation.observedPurpose).toBe('general_summary');
      expect(violation.reason).toBe('purpose_mismatch');
    }
  });

  test('a JSON outbound carrying ONLY in-purpose values PASSES', () => {
    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getContact',
          declaredPurpose: 'send_calendar_invite',
          fields: { email: PLANTED_EMAIL, phone: PLANTED_PHONE },
        },
      ],
      outbound: [
        {
          sinkId: 'sink-invite',
          kind: 'tool_call',
          purpose: 'send_calendar_invite',
          content: {
            invite: {
              to: PLANTED_EMAIL,
              dialIn: PLANTED_PHONE,
              title: 'Sync',
              time: '2026-07-01T15:00Z',
            },
          },
        },
      ],
    };
    const v = gate(input);
    expect(v.verdict).toBe('pass');
    expect(v.violations).toHaveLength(0);
    expect(v.scanned.trackedFields).toBe(2);
  });

  test('SAFETY INVARIANT holds for structured content: no raw atom in the verdict', () => {
    const v = gate({
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getContact',
          declaredPurpose: 'send_calendar_invite',
          fields: { email: PLANTED_EMAIL, phone: PLANTED_PHONE },
        },
      ],
      outbound: [
        {
          sinkId: 'sink-json',
          kind: 'log',
          purpose: 'general_summary',
          content: { a: PLANTED_EMAIL, b: { c: PLANTED_PHONE } },
        },
      ],
    });
    const serialized = JSON.stringify(v);
    expect(serialized).not.toContain(PLANTED_EMAIL);
    expect(serialized).not.toContain('alice.planted');
    expect(serialized).not.toContain('5550101234');
    expect(serialized).not.toContain('010-1234');
  });

  test('structured content is deterministic across 50 runs', () => {
    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getContact',
          declaredPurpose: 'send_calendar_invite',
          fields: { email: PLANTED_EMAIL, phone: PLANTED_PHONE },
        },
      ],
      outbound: [
        {
          sinkId: 's',
          kind: 'log',
          purpose: 'general_summary',
          content: { rows: [{ x: PLANTED_EMAIL }, { y: PLANTED_PHONE }] },
        },
      ],
    };
    const first = JSON.stringify(gate(input));
    for (let i = 0; i < 50; i++) {
      expect(JSON.stringify(gate(input))).toBe(first);
    }
  });

  test('BACK-COMPAT: a stringified-JSON payload behaves exactly as before', () => {

    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getContact',
          declaredPurpose: 'send_calendar_invite',
          fields: { email: PLANTED_EMAIL, phone: PLANTED_PHONE },
        },
      ],
      outbound: [
        {
          sinkId: 's',
          kind: 'user_message',
          purpose: 'general_summary',
          content: `{"reach":"${PLANTED_EMAIL}","mobile":"${PLANTED_PHONE}"}`,
        },
      ],
    };
    const v = gate(input);
    expect(v.verdict).toBe('leak');
    expect(v.violations).toHaveLength(2);
  });

  test('non-string leaves (number/boolean/null) never trip the gate', () => {
    const input: GateInput = {
      toolResults: [
        {
          toolCallId: 'tc-1',
          toolName: 'getOrder',
          declaredPurpose: 'general_summary',
          fields: { note: 'nothing private here' },
        },
      ],
      outbound: [
        {
          sinkId: 's',
          kind: 'user_message',
          purpose: 'general_summary',
          content: { total: 4111111111111111, paid: true, ref: null, items: [1, 2, 3] },
        },
      ],
    };
    const v = gate(input);

    expect(v.scanned.trackedFields).toBe(0);
    expect(v.verdict).toBe('pass');
  });
});

describe('KNOWN GAPS (documented unproven, NOT yet caught)', () => {
  const trackedEmail = 'alice.planted@example.invalid';
  const tool = {
    toolCallId: 'tc-1',
    toolName: 'getContact',
    declaredPurpose: 'send_calendar_invite' as const,
    fields: { email: trackedEmail },
  };

  test('KNOWN GAP: base64-encoded value is NOT caught (no decoding)', () => {
    const encoded = Buffer.from(trackedEmail).toString('base64');
    const v = gate({
      toolResults: [tool],
      outbound: [
        { sinkId: 's', kind: 'log', purpose: 'general_summary', content: `blob=${encoded}` },
      ],
    });
    expect(v.verdict).toBe('pass');
  });

  test('KNOWN GAP: hex-encoded value is NOT caught (no decoding)', () => {
    const hex = Buffer.from(trackedEmail).toString('hex');
    const v = gate({
      toolResults: [tool],
      outbound: [{ sinkId: 's', kind: 'log', purpose: 'general_summary', content: `0x${hex}` }],
    });
    expect(v.verdict).toBe('pass');
  });

  test('KNOWN GAP: word-substitution ("at"/"dot") is NOT caught', () => {
    const wordy = trackedEmail.replace('@', ' at ').replace(/\./g, ' dot ');
    const v = gate({
      toolResults: [tool],
      outbound: [
        {
          sinkId: 's',
          kind: 'user_message',
          purpose: 'general_summary',
          content: `reach ${wordy}`,
        },
      ],
    });
    expect(v.verdict).toBe('pass');
  });

  test('KNOWN GAP: zero-width-character interleaving is NOT caught', () => {
    const zwsp = '\u200b';
    const obfuscated = trackedEmail.split('').join(zwsp);
    const v = gate({
      toolResults: [tool],
      outbound: [
        { sinkId: 's', kind: 'user_message', purpose: 'general_summary', content: obfuscated },
      ],
    });
    expect(v.verdict).toBe('pass');
  });

  test('KNOWN GAP: value SPLIT across two sinks is NOT caught (each sink scanned whole)', () => {
    const half = Math.floor(trackedEmail.length / 2);
    const v = gate({
      toolResults: [tool],
      outbound: [
        {
          sinkId: 's1',
          kind: 'log',
          purpose: 'general_summary',
          content: trackedEmail.slice(0, half),
        },
        {
          sinkId: 's2',
          kind: 'log',
          purpose: 'general_summary',
          content: trackedEmail.slice(half),
        },
      ],
    });
    expect(v.verdict).toBe('pass');
  });
});
