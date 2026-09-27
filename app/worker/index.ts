import { gate } from '../../src/index.js';
import { parseGateInput } from './schema.js';

export interface Env {
  readonly ASSETS: { fetch: (req: Request) => Promise<Response> };
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/gate') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST only' }), {
          status: 405,
          headers: JSON_HEADERS,
        });
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'invalid JSON' }), {
          status: 400,
          headers: JSON_HEADERS,
        });
      }
      const parsed = parseGateInput(body);
      if (!parsed.ok) {
        return new Response(JSON.stringify({ error: parsed.error }), {
          status: 422,
          headers: JSON_HEADERS,
        });
      }
      const verdict = gate(parsed.value);
      return new Response(JSON.stringify(verdict), { status: 200, headers: JSON_HEADERS });
    }

    return env.ASSETS.fetch(request);
  },
};
