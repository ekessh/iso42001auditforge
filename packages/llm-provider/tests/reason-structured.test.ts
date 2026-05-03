// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PT_VERSION, buildAllProviders } from './fixtures.js';

const Schema = z.object({ answer: z.string() });

describe('reasonStructured returns reasoning trace', () => {
  it('Ollama (CoT prompt fallback) extracts reasoning from <reasoning>...<answer>JSON</answer>', async () => {
    const h = buildAllProviders();
    const handlerHttp = h.ollamaHttp;
    handlerHttp.calls.length = 0;
    const ollama = new (await import('../src/providers/ollama.js')).OllamaProvider({
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3.1:8b',
      templates: h.templates,
      fetchImpl: new (await import('./fixtures.js')).MockHttp((url) => {
        if (url.endsWith('/api/show')) return { status: 200, body: { digest: 'd' } };
        return {
          status: 200,
          body: {
            response:
              '<reasoning>step by step.</reasoning><answer>{"answer":"42"}</answer>',
            prompt_eval_count: 5,
            eval_count: 5,
          },
        };
      }).fetch,
    });
    const r = await ollama.reasonStructured('q', Schema, {
      promptTemplateVersion: PT_VERSION,
    });
    expect(r.value.answer).toBe('42');
    expect(r.reasoningTrace).toMatch(/step by step/);
  });

  it('Anthropic returns reasoning trace from thinking blocks', async () => {
    const h = buildAllProviders();
    const r = await h.anthropic.reasonStructured('q', Schema, {
      promptTemplateVersion: PT_VERSION,
      effortLevel: 'medium',
    });
    expect(r.value.answer).toBe('42');
    expect(r.reasoningTrace).toMatch(/considering/);
    expect(h.anthropicClient.calls[0]?.thinking?.budget_tokens).toBe(4096);
  });

  it('Anthropic effortLevel maps to thinking budget tokens', async () => {
    const h = buildAllProviders();
    await h.anthropic.reasonStructured('q', Schema, {
      promptTemplateVersion: PT_VERSION,
      effortLevel: 'high',
    });
    expect(h.anthropicClient.calls.at(-1)?.thinking?.budget_tokens).toBe(16384);
  });

  it('OpenAI passes reasoning effort and surfaces reasoning trace', async () => {
    const h = buildAllProviders();
    const r = await h.openai.reasonStructured('q', Schema, {
      promptTemplateVersion: PT_VERSION,
      effortLevel: 'high',
    });
    expect(r.value.answer).toBe('42');
    expect(r.reasoningTrace).toMatch(/considered/);
    expect(h.openaiClient.chatCalls[0]?.reasoning?.effort).toBe('high');
  });
});
