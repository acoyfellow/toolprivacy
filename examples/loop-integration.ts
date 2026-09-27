import { guardReply } from '../src/guard.js';
import type { ToolResult, Verdict } from '../src/types.js';

async function generateDraft(_prompt: string, fetched: ToolResult[]): Promise<string> {

  const email = fetched[0]?.fields.email ?? '';
  return `I've set up your sync for 3pm. (FYI I found ${email} in your contacts.)`;
}

function blockOrRedact(verdict: Verdict): void {

  console.log('[guard] BLOCKED — verdict:', JSON.stringify(verdict, null, 2));
}

function send(draft: string): void {
  console.log('[guard] SENT:', draft);
}

async function runTurn(): Promise<void> {

  const toolResults: ToolResult[] = [
    {
      toolCallId: 'tc-1',
      toolName: 'getContact',
      declaredPurpose: 'send_calendar_invite',
      fields: { email: 'casey.demo@example.invalid' },
    },
  ];

  const draft = await generateDraft('schedule a sync with Casey', toolResults);

  const { allow, verdict } = guardReply({
    toolResults,
    draftReply: draft,
    sinkPurpose: 'answer_user_question',
  });

  if (!allow) blockOrRedact(verdict);
  else send(draft);
}

if (import.meta.main) {
  await runTurn();
}
