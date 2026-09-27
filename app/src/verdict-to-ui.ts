import { ui, type UINode } from './genui/core.js';
import type { Verdict } from './gate-types.js';

function reasonText(reason: string): string {
  switch (reason) {
    case 'purpose_mismatch':
      return 'used somewhere its original purpose does not allow';
    case 'unknown_sink_purpose':
      return 'sent into a destination whose purpose is not recognized';
    case 'unknown_bound_purpose':
      return 'fetched under a purpose that is not recognized';
    default:
      return reason;
  }
}

function humanField(fieldPath: string): string {
  const known: Record<string, string> = {
    'getContact.email': "the contact's email address",
  };
  return known[fieldPath] ?? fieldPath;
}

function humanPurpose(purpose: string): string {
  const known: Record<string, string> = {
    send_calendar_invite: 'to send a calendar invite',
    general_summary: 'in a weekly summary',
  };
  return known[purpose] ?? purpose;
}

function humanClass(privateClass: string): string {
  const known: Record<string, string> = {
    email_address: 'email address',
    us_ssn: 'Social Security number',
    phone_number: 'phone number',
    payment_card: 'card number',
  };
  return known[privateClass] ?? privateClass.replace(/_/g, ' ');
}

export function verdictToUI(v: Verdict): UINode {
  const headline =
    v.verdict === 'leak'
      ? 'Leak caught before it could ship'
      : v.verdict === 'pass'
        ? 'Clean: every private detail was only used for the job it was fetched for'
        : 'Inconclusive: nothing outbound to scan';

  return ui(
    'Panel',
    { title: 'Gate verdict', subtitle: headline },
    ui(
      'StatRow',
      null,
      ui('Stat', { label: 'verdict' }, ui('VerdictBadge', { verdict: v.verdict })),
      ui('Stat', { label: 'places checked', value: String(v.scanned.sinks) }),
      ui('Stat', { label: 'private details watched', value: String(v.scanned.trackedFields) }),
      ui('Stat', { label: 'leaks found', value: String(v.violations.length) }),
    ),
    ...(v.violations.length
      ? v.violations.map((x) =>
          ui('ViolationCard', {
            fieldPath: humanField(x.fieldPath),
            privateClass: humanClass(x.privateClass),
            fetchedFor: humanPurpose(x.boundPurpose),
            usedIn: humanPurpose(x.observedPurpose),
            reason: reasonText(x.reason),
          }),
        )
      : [
          ui(
            'EmptyState',
            null,
            'No leaks. Every private detail was only used for the job it was fetched for.',
          ),
        ]),
    ui(
      'Note',
      null,
      'Decided by a fixed rule, not an AI guess, so it gives the same answer every time.',
    ),
  );
}
