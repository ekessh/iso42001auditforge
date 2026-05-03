// SPDX-License-Identifier: BUSL-1.1
import type { ZodTypeAny, ZodSchema } from 'zod';

export interface ProviderMetadata {
  provider: string;
  modelName: string;
  modelHash?: string;
  modelVersion?: string;
  contextWindow: number;
}

export interface CompletionOpts {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  promptTemplateVersion: string;
  task?: string;
  consentRecordId?: string;
  engagementId?: string;
  firmId?: string;
  effortLevel?: 'low' | 'medium' | 'high';
}

export interface CompletionResult {
  output: string;
  tokensUsed: { input: number; output: number };
  latencyMs: number;
  costUsd?: number;
  modelMetadata: ProviderMetadata;
}

export interface ReasoningResult<T> {
  value: T;
  reasoningTrace: string;
  raw: CompletionResult;
}

export interface LLMProvider {
  complete(prompt: string, opts: CompletionOpts): Promise<CompletionResult>;
  embed(text: string | string[], opts?: { model?: string }): Promise<number[][]>;
  classifyStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: CompletionOpts,
  ): Promise<T>;
  reasonStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: CompletionOpts & { effortLevel?: 'low' | 'medium' | 'high' },
  ): Promise<ReasoningResult<T>>;
  metadata(): ProviderMetadata;
  isCloud(): boolean;
  capabilities(): ProviderCapabilities;
}

export interface ProviderCapabilities {
  supportsReasoning: boolean;
  supportsEmbedding: boolean;
  supportsGrammar: boolean;
}

export type SchemaLike = ZodTypeAny;
