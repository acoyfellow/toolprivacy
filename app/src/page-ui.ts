import GUARD_SNIPPET from "./snippets/guard.txt?raw";
import CALL_SNIPPET from "./snippets/call.txt?raw";
import { ui, type UINode } from './genui/core.js';

export interface PageOpts {

  readonly scenarios: ReadonlyArray<{ readonly key: string; readonly label: string }>;

  readonly verdictTree: UINode;
}



const SCHEMA_SNIPPET = `{
  "type": "Panel",
  "props": { "title": "toolprivacy gate" },
  "children": [
    { "type": "VerdictBadge", "props": { "verdict": "leak" } }
  ]
}`;

export function buildPage(opts: PageOpts): UINode {
  return ui(
    'Section',
    {},

    ui('Hero', {
      eyebrow: 'toolprivacy',
      title: 'Keep an AI agent from leaking your private information',
      lede: 'To get one job done, an AI agent often has to pull up something private about you, like your email address or a card number. This tool watches what the agent is about to say or send, and catches the moment that private detail shows up somewhere it was never meant to go. It does this before the agent replies, so the leak never actually leaves.',
    }),

    ui(
      'Section',
      { title: 'Why this matters to you', subtitle: 'What you get out of it, in plain terms' },
      ui(
        'Callout',
        { tone: 'info', title: 'Your private details stay where they belong' },
        'The email you handed over to set up one calendar invite should not resurface later in an unrelated summary. The card number you shared to make a payment should not get repeated back to you in chat. This adds a quick check that runs before anything is sent, so you can let an agent handle sensitive information and trust that it will not slip out the side door.',
      ),
    ),

    ui(
      'Section',
      {
        title: 'Try it yourself',
        subtitle: 'Pick a scenario and watch a real leak get caught, and a safe use pass through',
      },
      ui('ScenarioPicker', { options: opts.scenarios }),

      opts.verdictTree,
    ),

    ui(
      'Section',
      {
        title: 'The idea behind it',
        subtitle: 'Why we tie each piece of data to the job it was fetched for',
      },
      ui(
        'Note',
        null,
        'When the agent looked up your email, it was for one specific job: sending a calendar invite. So we keep that piece of data tied to that job. If the same email later turns up in something unrelated, like a weekly summary, it has wandered away from what it was collected for, and that is the leak we flag. We call this purpose-bound: a value stays bound to the task it was fetched for.',
      ),
      ui(
        'Callout',
        { tone: 'info', title: 'Why the value alone is not enough to judge' },
        'The same email is perfectly fine in the invite it was fetched for, and a leak in an unrelated summary. The value is identical in both places, so just checking whether it appears cannot tell the two apart. Tying each value to the purpose it was fetched for is what makes the difference visible.',
      ),
    ),

    ui(
      'Section',
      {
        title: 'Same email, two outcomes',
        subtitle: 'The only thing that changes is where the email ends up',
      },
      ui(
        'BeforeAfter',
        null,
        ui(
          'Callout',
          { tone: 'bad', title: 'Used somewhere it should not be: caught' },
          ui('CodeBlock', {
            caption: 'fetched to send a calendar invite, then used in a general summary',
            lang: 'text',
            code: 'Here is your week. I also noticed alice@example.invalid in your contacts.',
          }),
          ui('Note', null, 'The address never belonged in a general summary. Flagged.'),
        ),
        ui(
          'Callout',
          { tone: 'good', title: 'Used for the job it was fetched for: fine' },
          ui('CodeBlock', {
            caption: 'fetched to send a calendar invite, then used to send that invite',
            lang: 'json',
            code: '{ "to": "alice@example.invalid", "title": "Sync" }',
          }),
          ui('Note', null, 'Same address, placed into the invite it was fetched for. Clean.'),
        ),
      ),
      ui(
        'Note',
        null,
        'A plain "did this value appear?" check cannot tell these two apart, because the value is the same in both. It flags the safe use right alongside the leak. Binding each value to the job it was fetched for is what separates them.',
      ),
    ),

    ui(
      'Section',
      {
        title: 'What it catches, measured',
        subtitle: 'Real numbers from a small honest test set, including the cases it misses',
      },
      ui(
        'Note',
        null,
        'We ran it against a small set of hand-built cases to see what it actually does, not what we hoped. On the kind of leak it is built for, a private value showing up plainly, or with its digits reformatted, somewhere it does not belong, it caught every one. It never raised a false alarm on a safe, in-purpose use, and each decision landed in well under a millisecond.',
      ),
      ui(
        'StatRow',
        null,
        ui('Stat', { value: '100%', label: 'of the in-scope leaks in the test set, caught' }),
        ui('Stat', { value: '0', label: 'false alarms on safe, in-purpose uses' }),
        ui('Stat', { value: 'under 1ms', label: 'to reach a verdict' }),
      ),
      ui(
        'Note',
        null,
        'It also reads structured replies, not just plain text. When a reply is JSON, it looks inside every nested field and reports every private detail that has slipped out of purpose, not only the first one it finds.',
      ),
      ui(
        'Callout',
        { tone: 'warn', title: 'And here is what it does not catch yet' },
        'If a private value is encoded, reworded in the agent\u2019s own phrasing, or split across more than one message, it slips past today. In the same test set it caught none of those: a measured zero, not a rounding. That is a known gap we are stating in the open, not hiding. It reliably catches plain and digit-reformatted leaks; the rest is honest future work.',
      ),
    ),

    ui(
      'Section',
      {
        title: "What this is, and what it isn't",
        subtitle: 'So you can judge in seconds whether it fits your situation',
      },
      ui(
        'Note',
        null,
        'This is a safety net for a normal, well-meaning agent that fetches your data to help and then accidentally lets a private detail slip somewhere it should not go. That is what it is built for, and what it is good at. It is not a defense against someone deliberately trying to smuggle your data out, and it does not yet catch a leak that has been reworded or disguised. Knowing that boundary up front is part of trusting it.',
      ),
    ),

    ui(
      'Section',
      {
        title: 'Drop it into your agent',
        subtitle: 'One call, right before the reply goes out',
      },
      ui(
        'Note',
        null,
        'Wiring it in is a single step. Right before your agent sends its reply, you call this; it says allow or block, and you let that decide whether the reply ships.',
      ),
      ui('CodeBlock', {
        caption: 'guardReply(...) returns { allow, verdict } — call it just before you send',
        lang: 'ts',
        code: GUARD_SNIPPET,
      }),
    ),

    ui(
      'Section',
      {
        title: 'For builders: how you would wire it in',
        subtitle: 'One pure function call; it returns pass, leak, or inconclusive',
      },
      ui('CodeBlock', {
        caption: 'gate(input) returns pass | leak | inconclusive',
        lang: 'ts',
        code: CALL_SNIPPET,
      }),
      ui(
        'Note',
        null,
        'Flip the outbound purpose to send_calendar_invite and the same value passes clean. That single comparison is the whole idea.',
      ),
    ),

    ui(
      'Section',
      {
        title: 'How it decides, step by step',
        subtitle: 'Five plain steps, no AI model in the loop, the same answer every run',
      },
      ui(
        'Note',
        null,
        'There is no second AI reading the text to guess whether it leaked. That would be slow, costly, and could answer differently each time, which is a poor referee for a privacy boundary. This is one ordinary function: the same input always gives the same verdict.',
      ),
      ui('FlowDiagram', {
        steps: [
          'each tool call records why it fetched the data',
          'the fetched fields get sorted by what kind of private value they are',
          'everything about to leave the agent is scanned for those values',
          'the job a value was fetched for is compared with where it is now headed',
          'a plain pass / leak / inconclusive verdict comes out, carrying no copy of the value',
        ],
      }),
    ),

    ui(
      'Section',
      {
        title: 'A note for the curious: this page is its own data',
        subtitle: 'Everything above is one data tree, rendered against a set of components',
      },
      ui(
        'Note',
        null,
        'The intro, the before and after, the snippet, the steps, and the live verdict are all the same serializable shape. A node is just a type, some props, and children:',
      ),
      ui('JsonView', { json: SCHEMA_SNIPPET }),
      ui('Legend', {
        items: [
          { term: 'type', plain: 'which component to render' },
          { term: 'props', plain: 'the plain, serializable inputs to that component' },
          { term: 'children', plain: 'nested nodes or text, rendered inside' },
        ],
      }),
    ),
  );
}
