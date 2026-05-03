// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { StructuredParseError } from '../src/index.js';
import { OllamaProvider } from '../src/providers/ollama.js';
import { MockHttp, PT_VERSION, buildTemplates } from './fixtures.js';

const Schema = z.object({ answer: z.string() });

describe('classifyStructured', () => {
  it('rejects malformed output from Ollama after 3 retries', async () => {
    const templates = buildTemplates();
    const http = new MockHttp(() => ({
      status: 200,
      body: { response: 'not json at all' },
    }));
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3.1:8b',
      templates,
      fetchImpl: http.fetch,
    });
    await expect(
      provider.classifyStructured('q', Schema, { promptTemplateVersion: PT_VERSION }),
    ).rejects.toBeInstanceOf(StructuredParseError);
    expect(http.calls.length).toBe(3);
  });

  it('rejects schema-mismatched output and retries 3 times', async () => {
    const templates = buildTemplates();
    const http = new MockHttp(() => ({
      status: 200,
      body: { response: '{"answer": 42}' },
    }));
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3.1:8b',
      templates,
      fetchImpl: http.fetch,
    });
    await expect(
      provider.classifyStructured('q', Schema, { promptTemplateVersion: PT_VERSION }),
    ).rejects.toBeInstanceOf(StructuredParseError);
    expect(http.calls.length).toBe(3);
  });

  it('Ollama uses format=json on the request', async () => {
    const templates = buildTemplates();
    const http = new MockHttp(() => ({
      status: 200,
      body: { response: '{"answer":"ok"}' },
    }));
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3.1:8b',
      templates,
      fetchImpl: http.fetch,
    });
    await provider.classifyStructured('q', Schema, { promptTemplateVersion: PT_VERSION });
    expect((http.calls[0]?.body as { format?: string }).format).toBe('json');
  });

  it('LlamaCpp passes a grammar in the request body', async () => {
    const templates = buildTemplates();
    const http = new MockHttp(() => ({
      status: 200,
      body: { content: '{"answer":"ok"}' },
    }));
    const { LlamaCppProvider } = await import('../src/providers/llamacpp.js');
    const provider = new LlamaCppProvider({
      baseUrl: 'http://localhost:8080',
      defaultModel: 'llama-3.1-8b',
      templates,
      fetchImpl: http.fetch,
    });
    await provider.classifyStructured('q', Schema, { promptTemplateVersion: PT_VERSION });
    expect((http.calls[0]?.body as { grammar?: string }).grammar).toMatch(/root/);
  });

  it('Anthropic uses tool-use with strict schema and rejects when tool not invoked', async () => {
    const templates = buildTemplates();
    const { AnthropicProvider } = await import('../src/providers/anthropic.js');
    const { MockAnthropicClient } = await import('./fixtures.js');
    const client = new MockAnthropicClient(() => ({
      id: 'msg',
      model: 'claude-opus-4-5',
      content: [{ type: 'text', text: 'I refuse to use tools.' }],
      usage: { input_tokens: 1, output_tokens: 1 },
      stop_reason: 'end_turn',
    }));
    const provider = new AnthropicProvider({
      defaultModel: 'claude-opus-4-5',
      templates,
      client,
    });
    await expect(
      provider.classifyStructured('q', Schema, { promptTemplateVersion: PT_VERSION }),
    ).rejects.toBeInstanceOf(StructuredParseError);
    expect(client.calls.length).toBe(3);
  });

  it('OpenAI requests json_object response format', async () => {
    const templates = buildTemplates();
    const { OpenAIProvider } = await import('../src/providers/openai.js');
    const { MockOpenAIClient } = await import('./fixtures.js');
    const client = new MockOpenAIClient((req) => ({
      id: 'c',
      model: req.model,
      choices: [{ message: { content: '{"answer":"x"}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }));
    const provider = new OpenAIProvider({
      defaultModel: 'gpt-4.1',
      templates,
      client,
    });
    await provider.classifyStructured('q', Schema, { promptTemplateVersion: PT_VERSION });
    expect(client.chatCalls[0]?.response_format?.type).toBe('json_object');
  });
});
