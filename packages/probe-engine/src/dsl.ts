// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import {
  ProbeDefinitionMetaSchema,
  type ProbeDefinitionMeta,
  type ProbeExecution,
} from './types.js';

/**
 * Runtime context handed to a probe's `run` function.
 *
 * Probes never call `fetch` / `process` / `fs` directly — they go through
 * `inferenceClient` (for model calls) and `random` (seeded RNG). All side
 * effects flow through the runner so the sandbox can mediate them.
 */
export interface ProbeRunContext {
  readonly engagementId: string;
  readonly executionId: string;
  readonly mode: 'offline' | 'live' | 'replay';
  /** Seeded deterministic random in [0, 1). */
  readonly random: () => number;
  /**
   * Optional inference client. Probes that declare
   * `requiresInferenceClient = true` must throw if this is `null`.
   */
  readonly inferenceClient: InferenceClient | null;
  /** Wall-clock deadline (epoch ms). Probes should bail near it. */
  readonly deadlineMs: number;
  /** Logger handed in by the runner; structured. */
  readonly log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) => void;
}

/**
 * Minimal inference-client surface. Connectors / apps wire this to the actual
 * transport (OpenAI, Ollama, generic OpenAPI). A probe never sees the URL.
 */
export interface InferenceClient {
  /**
   * Single-turn completion request. The actual model id, base URL, headers etc.
   * are baked into the client; the probe only supplies the prompt.
   */
  complete(req: InferenceRequest): Promise<InferenceResponse>;
  /** Optional embedding for probes that need vectors. */
  embed?(text: string): Promise<readonly number[]>;
  /** Optional vision endpoint. */
  classify?(input: ImageClassificationInput): Promise<ClassificationResponse>;
}

export interface InferenceRequest {
  readonly system?: string;
  readonly prompt: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly stop?: readonly string[];
  /** Probe-supplied metadata; passed through for telemetry only. */
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface InferenceResponse {
  readonly text: string;
  readonly finishReason?: 'stop' | 'length' | 'content_filter' | 'other';
  readonly tokensIn?: number;
  readonly tokensOut?: number;
  /** Cost reported by the provider (USD), if known. */
  readonly costUsd?: number;
  /** Raw JSON for evidence; do NOT include API keys. */
  readonly raw?: unknown;
}

export interface ImageClassificationInput {
  /** Base64 PNG/JPEG bytes. The runner already redacted EXIF. */
  readonly imageB64: string;
  readonly hint?: string;
}

export interface ClassificationResponse {
  readonly label: string;
  readonly score: number;
  readonly raw?: unknown;
}

/** Result returned by a probe's `run` function before the runner wraps it. */
export interface ProbeRunResult<R = unknown> {
  readonly verdict: 'pass' | 'fail' | 'inconclusive';
  /** 0..1 score (1 = perfect; 0 = worst). */
  readonly score: number;
  readonly derivedMetrics: Readonly<Record<string, number | string | boolean>>;
  readonly rawResponse?: R;
  /** Evidence not yet stored; runner persists / hashes / signs. */
  readonly evidence?: ReadonlyArray<{
    kind:
      | 'raw-response'
      | 'derived-metric'
      | 'sample-set'
      | 'screenshot'
      | 'trace'
      | 'fixture'
      | 'report';
    contentType: string;
    inline?: unknown;
  }>;
}

/** Full bundle a probe author exports. */
export interface ProbeDefinition<P, R = unknown> {
  readonly meta: ProbeDefinitionMeta;
  /** Zod schema for `params`. */
  readonly parametersSchema: z.ZodType<P>;
  readonly run: (ctx: ProbeRunContext, params: P) => Promise<ProbeRunResult<R>>;
}

/**
 * Validate a probe definition's metadata at module load time. Throws a
 * `ZodError` on bad metadata so we surface authoring mistakes early.
 */
export function defineProbe<P, R = unknown>(
  def: ProbeDefinition<P, R>,
): ProbeDefinition<P, R> {
  ProbeDefinitionMetaSchema.parse(def.meta);
  if (def.meta.requiresInferenceClient && def.meta.executionModes.length === 0) {
    throw new Error(
      `Probe ${def.meta.id} requires an inference client but lists no execution modes.`,
    );
  }
  return def;
}

/** Type-erased holder used by the registry / runner. */
export type AnyProbeDefinition = ProbeDefinition<unknown, unknown>;

/** Hash-pin of a probe (id + version + content hash). */
export interface ProbePin {
  readonly id: string;
  readonly version: string;
  readonly metaHash: string;
}

/** Convenience factory used by individual probe modules. */
export function asAnyProbe<P, R>(def: ProbeDefinition<P, R>): AnyProbeDefinition {
  return def as unknown as AnyProbeDefinition;
}

/** Guard that an execution result satisfies the union shape. */
export function isProbeRunResult(value: unknown): value is ProbeRunResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.verdict === 'string' &&
    ['pass', 'fail', 'inconclusive'].includes(v.verdict as string) &&
    typeof v.score === 'number' &&
    v.score >= 0 &&
    v.score <= 1 &&
    typeof v.derivedMetrics === 'object' &&
    v.derivedMetrics !== null
  );
}

export type { ProbeExecution };
