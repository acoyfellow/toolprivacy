export const POLICY_VERSION = 'toolprivacy.policy.v0.0.1';

export const PURPOSE_TAXONOMY = [
  'send_calendar_invite',
  'send_email',
  'book_travel',
  'lookup_contact',
  'general_summary',
  'answer_user_question',
  'internal_reasoning',
] as const;

export type Purpose = (typeof PURPOSE_TAXONOMY)[number];

export interface PrivateClass {
  readonly id: string;
  readonly detector: RegExp;

  readonly normalize?: (s: string) => string;

  readonly validate?: (value: string) => boolean;
}

const digitsOnly = (s: string): string => s.replace(/[^0-9]/g, '');

function luhnValid(digits: string): boolean {
  const len = digits.length;
  if (len < 13 || len > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = len - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export const PRIVATE_CLASSES: readonly PrivateClass[] = [
  {
    id: 'email_address',
    detector: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  },
  {
    id: 'phone_number',

    detector:
      /(?:\+\d{1,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,4}\d{2,4})|(?:\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/,
    normalize: digitsOnly,
  },
  {
    id: 'payment_card',

    detector: /(?<![0-9])(?:\d[ -]?){13,19}(?![0-9])/,
    normalize: digitsOnly,

    validate: (value) => luhnValid(digitsOnly(value)),
  },
  {
    id: 'us_ssn',
    detector: /\b\d{3}-\d{2}-\d{4}\b/,
    normalize: digitsOnly,
  },
];

export const PURPOSE_COMPATIBILITY: Record<Purpose, readonly Purpose[]> = {

  send_calendar_invite: ['send_calendar_invite'],

  send_email: ['send_email'],

  book_travel: ['book_travel'],

  lookup_contact: ['lookup_contact', 'answer_user_question'],

  general_summary: ['general_summary', 'answer_user_question'],
  answer_user_question: ['answer_user_question'],

  internal_reasoning: ['internal_reasoning'],
};
