// SPDX-License-Identifier: BUSL-1.1
import { OllamaAdapter, type OllamaAdapterOptions } from './ollama.js';
import { VllmAdapter, type VllmAdapterOptions } from './vllm.js';
import type { LocalLlmAdapter } from './types.js';

export type LocalLlmFactoryOptions =
  | ({ kind: 'ollama' } & OllamaAdapterOptions)
  | ({ kind: 'vllm' } & VllmAdapterOptions);

export function createLocalLlm(opts: LocalLlmFactoryOptions): LocalLlmAdapter {
  if (opts.kind === 'ollama') {
    const { kind: _kind, ...rest } = opts;
    return new OllamaAdapter(rest);
  }
  const { kind: _kind, ...rest } = opts;
  return new VllmAdapter(rest);
}
