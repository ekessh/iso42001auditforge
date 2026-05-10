// SPDX-License-Identifier: BUSL-1.1
import {
  TranscriptionError,
  TranscriptSegmentSchema,
  type AudioSource,
  type TranscribeOptions,
  type TranscriptSegment,
  type TranscriptionProvider,
} from '../types.js';

export interface WhisperXProviderOptions {
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly fetchImpl?: typeof fetch;
}

interface SidecarResponse {
  readonly segments: unknown[];
}

export class WhisperXProvider implements TranscriptionProvider {
  public readonly name = 'whisperx';
  private readonly opts: WhisperXProviderOptions;

  constructor(opts: WhisperXProviderOptions) {
    this.opts = opts;
  }

  async *transcribe(
    audio: AudioSource,
    opts?: TranscribeOptions,
  ): AsyncIterable<TranscriptSegment> {
    const buffer = await this.materialize(audio);
    const fetcher = this.opts.fetchImpl ?? globalThis.fetch;
    if (!fetcher) {
      throw new TranscriptionError('fetch is not available', 'NO_FETCH');
    }
    const headers: Record<string, string> = {
      'content-type': audio.mimeType,
    };
    if (this.opts.apiKey) headers['authorization'] = `Bearer ${this.opts.apiKey}`;
    if (opts?.language) headers['x-language'] = opts.language;
    const url = `${this.opts.endpoint.replace(/\/$/, '')}/transcribe`;
    let res: Response;
    try {
      res = await fetcher(url, {
        method: 'POST',
        headers,
        body: buffer as BodyInit,
        ...(opts?.signal ? { signal: opts.signal } : {}),
      });
    } catch (err) {
      throw new TranscriptionError('sidecar unreachable', 'NETWORK', err);
    }
    if (!res.ok) {
      throw new TranscriptionError(`sidecar HTTP ${res.status}`, 'HTTP_ERROR');
    }
    const json = (await res.json()) as SidecarResponse;
    for (const raw of json.segments) {
      const parsed = TranscriptSegmentSchema.safeParse(raw);
      if (!parsed.success) {
        throw new TranscriptionError('sidecar returned invalid segment', 'SCHEMA');
      }
      yield parsed.data;
    }
  }

  private async materialize(audio: AudioSource): Promise<Uint8Array> {
    if (audio.kind === 'buffer') return audio.data;
    const parts: Uint8Array[] = [];
    let total = 0;
    for await (const chunk of audio.chunks) {
      parts.push(chunk);
      total += chunk.byteLength;
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.byteLength;
    }
    return out;
  }
}
