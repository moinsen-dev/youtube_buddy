import { z } from 'zod';

import { CloudEngine } from './cloud-engine';
import type { GenerateRequest } from './types';

const schema = z.object({ tldr: z.string(), score: z.number() });

function req(): GenerateRequest<{ tldr: string; score: number }> {
  return {
    template: {
      id: 'test.v1',
      system: 'You summarize.',
      render: (input) => `Summarize: ${String((input as { text: string }).text)}`,
    },
    input: { text: 'Ein Video über Brot.' },
    schema,
  };
}

function engineWith(fetchFn: typeof fetch): CloudEngine {
  return new CloudEngine({
    endpointUrl: 'https://europe-west3-proj.cloudfunctions.net/analyze',
    getIdToken: async () => 'id-token-123',
    fetchFn,
  });
}

describe('CloudEngine', () => {
  it('posts system/prompt/json-schema with bearer token and parses the result', async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    const engine = engineWith(async (url, init) => {
      captured = { url: String(url), init };
      return new Response(
        JSON.stringify({
          text: '{"tldr":"Brotvideo","score":4}',
          stats: { durationMs: 812, totalTokens: 321 },
        }),
        { status: 200 },
      );
    });
    const result = await engine.generate(req());
    expect(result.data).toEqual({ tldr: 'Brotvideo', score: 4 });
    expect(result.stats).toMatchObject({ totalTokens: 321, durationMs: 812, repaired: false });

    const body = JSON.parse(String(captured!.init!.body)) as {
      system: string;
      prompt: string;
      schema: { type: string };
    };
    expect(body.system).toBe('You summarize.');
    expect(body.prompt).toContain('Ein Video über Brot.');
    expect(body.schema.type).toBe('object'); // zod → JSON schema conversion
    expect((captured!.init!.headers as Record<string, string>).Authorization).toBe(
      'Bearer id-token-123',
    );
  });

  it('throws on function errors with the server message', async () => {
    const engine = engineWith(
      async () => new Response(JSON.stringify({ error: 'invalid token' }), { status: 401 }),
    );
    await expect(engine.generate(req())).rejects.toThrow('invalid token');
  });

  it('rejects payloads that fail client-side zod validation', async () => {
    const engine = engineWith(
      async () => new Response(JSON.stringify({ text: '{"tldr":5}' }), { status: 200 }),
    );
    await expect(engine.generate(req())).rejects.toThrow("template 'test.v1'");
  });

  it('keeps embedding on-device', async () => {
    await expect(engineWith(async () => new Response('{}')).embed(['x'])).rejects.toThrow(
      'on-device',
    );
  });
});
