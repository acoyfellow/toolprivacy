import type { GateInput } from '../../src/types.js';

export interface GateApiResponseError {
  readonly error: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseGateInput(body: unknown): { ok: true; value: GateInput } | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: 'body must be an object' };
  const { toolResults, outbound } = body;
  if (!Array.isArray(toolResults)) return { ok: false, error: 'toolResults must be an array' };
  if (!Array.isArray(outbound)) return { ok: false, error: 'outbound must be an array' };

  for (const tr of toolResults) {
    if (!isRecord(tr) || typeof tr.toolName !== 'string' || typeof tr.declaredPurpose !== 'string') {
      return { ok: false, error: 'each toolResult needs string toolName + declaredPurpose' };
    }
    if (!isRecord(tr.fields)) return { ok: false, error: 'toolResult.fields must be an object' };
    for (const fv of Object.values(tr.fields)) {
      if (typeof fv !== 'string') return { ok: false, error: 'all toolResult.fields values must be strings' };
    }
  }
  for (const s of outbound) {
    if (!isRecord(s) || typeof s.sinkId !== 'string' || typeof s.content !== 'string') {
      return { ok: false, error: 'each sink needs string sinkId + content' };
    }
    if (s.kind !== 'user_message' && s.kind !== 'tool_call' && s.kind !== 'log') {
      return { ok: false, error: 'sink.kind must be user_message|tool_call|log' };
    }
    if (typeof s.purpose !== 'string') return { ok: false, error: 'sink.purpose must be a string' };
  }
  return { ok: true, value: body as unknown as GateInput };
}
