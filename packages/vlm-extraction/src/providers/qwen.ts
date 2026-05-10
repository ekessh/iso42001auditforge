// SPDX-License-Identifier: BUSL-1.1
import type { ZodType } from 'zod';
import { redactPiiDeep } from '../redaction.js';
import {
  VlmExtractionError,
  type ExtractOptions,
  type ExtractionResult,
  type VlmExtractor,
} from '../types.js';

export interface SidecarVlmOptions {
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly fetchImpl?: typeof fetch;
}

interface SidecarBody {
  readonly value: unknown;
  readonly confidence: number;
  readonly sourceRegions: unknown[];
  readonly modelName: string;
  readonly modelHash?: string;
}

export class QwenVlProvider implements VlmExtractor {
  public readonly name = 'qwen2.5-vl';
  constructor(private readonly opts: SidecarVlmOptions) {}

  async extract<T>(
    image: Uint8Array,
    schema: ZodType<T>,
    opts: ExtractOptions,
  ): Promise<ExtractionResult<T>> {
    return runSidecarExtraction({
      providerName: this.name,
      endpoint: this.opts.endpoint,
      ...(this.opts.apiKey !== undefined ? { apiKey: this.opts.apiKey } : {}),
      ...(this.opts.fetchImpl !== undefined ? { fetchImpl: this.opts.fetchImpl } : {}),
      image,
      schema,
      opts,
    });
  }
}

export async function runSidecarExtraction<T>(p: {
  readonly providerName: string;
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly fetchImpl?: typeof fetch;
  readonly image: Uint8Array;
  readonly schema: ZodType<T>;
  readonly opts: ExtractOptions;
}): Promise<ExtractionResult<T>> {
  const fetcher = p.fetchImpl ?? globalThis.fetch;
  if (!fetcher) throw new VlmExtractionError('fetch unavailable', 'NO_FETCH');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (p.apiKey) headers['authorization'] = `Bearer ${p.apiKey}`;
  const url = `${p.endpoint.replace(/\/$/, '')}/extract`;
  const body = JSON.stringify({
    schemaId: p.opts.schemaId,
    image_b64: bufferToBase64(p.image),
    ...(p.opts.engagementId !== undefined ? { engagementId: p.opts.engagementId } : {}),
  });
  let res: Response;
  try {
    res = await fetcher(url, {
      method: 'POST',
      headers,
      body,
      ...(p.opts.signal ? { signal: p.opts.signal } : {}),
    });
  } catch (err) {
    throw new VlmExtractionError('sidecar unreachable', 'NETWORK', err);
  }
  if (!res.ok) throw new VlmExtractionError(`sidecar HTTP ${res.status}`, 'HTTP_ERROR');
  const data = (await res.json()) as SidecarBody;
  const candidate = p.opts.redactPii ?? true ? redactPiiDeep(data.value) : data.value;
  const parsed = p.schema.safeParse(candidate);
  if (!parsed.success) {
    throw new VlmExtractionError('extraction failed schema', 'SCHEMA');
  }
  const sourceRegions = (data.sourceRegions ?? []).map((r) =>
    r as ExtractionResult<unknown>['sourceRegions'][number],
  );
  return {
    value: parsed.data,
    confidence: data.confidence,
    sourceRegions,
    modelName: data.modelName ?? p.providerName,
    ...(data.modelHash !== undefined ? { modelHash: data.modelHash } : {}),
    extractedAt: new Date().toISOString(),
  };
}

function bufferToBase64(buf: Uint8Array): string {
  let s = '';
  for (let i = 0; i < buf.byteLength; i += 1) s += String.fromCharCode(buf[i] ?? 0);
  return globalThis.btoa(s);
}
