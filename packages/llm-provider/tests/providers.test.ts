// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PT_VERSION, buildAllProviders } from './fixtures.js';

const Schema = z.object({ answer: z.string() });

describe('Provider parity', () => {
  it('Ollama returns a CompletionResult shape with usage and metadata', async () => {
    const h = buildAllProviders();
    const out = await h.ollama.complete('q', { promptTemplateVersion: PT_VERSION });
    expect(out.tokensUsed.input).toBe(4);
    expect(out.tokensUsed.output).toBe(2);
    expect(out.modelMetadata.provider).toBe('ollama');
    expect(out.modelMetadata.modelHash).toBe('sha256:abc123');
  });

  it('vLLM returns a CompletionResult shape with usage and metadata', async () => {
    const h = buildAllProviders();
    const out = await h.vllm.complete('q', { promptTemplateVersion: PT_VERSION });
    expect(out.tokensUsed.input).toBe(4);
    expect(out.modelMetadata.provider).toBe('vllm');
  });

  it('LlamaCpp returns a CompletionResult shape with usage and metadata', async () => {
    const h = buildAllProviders();
    const out = await h.llamacpp.complete('q', { promptTemplateVersion: PT_VERSION });
    expect(out.tokensUsed.output).toBe(2);
    expect(out.modelMetadata.provider).toBe('llamacpp');
  });

  it('Anthropic returns a CompletionResult shape with usage and metadata', async () => {
    const h = buildAllProviders();
    const out = await h.anthropic.complete('q', { promptTemplateVersion: PT_VERSION });
    expect(out.tokensUsed.input).toBe(4);
    expect(out.tokensUsed.output).toBe(2);
    expect(out.modelMetadata.provider).toBe('anthropic');
    expect(out.costUsd).toBeCloseTo(4 / 1000 * 0.015 + 2 / 1000 * 0.075, 8);
  });

  it('OpenAI returns a CompletionResult shape with usage and metadata', async () => {
    const h = buildAllProviders();
    const out = await h.openai.complete('q', { promptTemplateVersion: PT_VERSION });
    expect(out.tokensUsed.input).toBe(4);
    expect(out.modelMetadata.provider).toBe('openai');
    expect(out.costUsd).toBeCloseTo(4 / 1000 * 0.01 + 2 / 1000 * 0.03, 8);
  });

  it('classifyStructured succeeds across all 5 providers', async () => {
    const h = buildAllProviders();
    const a = await h.ollama.classifyStructured('q', Schema, { promptTemplateVersion: PT_VERSION });
    const b = await h.vllm.classifyStructured('q', Schema, { promptTemplateVersion: PT_VERSION });
    const c = await h.llamacpp.classifyStructured('q', Schema, { promptTemplateVersion: PT_VERSION });
    const d = await h.anthropic.classifyStructured('q', Schema, { promptTemplateVersion: PT_VERSION });
    const e = await h.openai.classifyStructured('q', Schema, { promptTemplateVersion: PT_VERSION });
    expect([a, b, c, d, e].every((r) => r.answer === '42')).toBe(true);
  });

  it('local providers expose isCloud=false', () => {
    const h = buildAllProviders();
    expect(h.ollama.isCloud()).toBe(false);
    expect(h.vllm.isCloud()).toBe(false);
    expect(h.llamacpp.isCloud()).toBe(false);
  });

  it('cloud providers expose isCloud=true', () => {
    const h = buildAllProviders();
    expect(h.anthropic.isCloud()).toBe(true);
    expect(h.openai.isCloud()).toBe(true);
  });

  it('embed returns matrix shape from local providers', async () => {
    const h = buildAllProviders();
    const o = await h.ollama.embed(['a', 'b']);
    expect(o.length).toBe(2);
    expect(o[0]?.length).toBe(3);
    const v = await h.vllm.embed(['x']);
    expect(v.length).toBe(1);
    const l = await h.llamacpp.embed('x');
    expect(l.length).toBe(1);
  });

  it('Anthropic.embed throws (no embedding capability)', async () => {
    const h = buildAllProviders();
    await expect(h.anthropic.embed('x')).rejects.toThrow();
  });

  it('OpenAI embed returns dense vectors via mock', async () => {
    const h = buildAllProviders();
    const out = await h.openai.embed(['x', 'y']);
    expect(out.length).toBe(2);
  });
});
