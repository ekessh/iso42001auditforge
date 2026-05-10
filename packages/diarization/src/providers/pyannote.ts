// SPDX-License-Identifier: BUSL-1.1
import {
  DiarizationError,
  SpeakerSegmentSchema,
  type DiarizationProvider,
  type DiarizeInput,
  type DiarizeOptions,
  type SpeakerSegment,
} from '../types.js';

export interface Pyannote31ProviderOptions {
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly fetchImpl?: typeof fetch;
}

interface SidecarResponse {
  readonly segments: unknown[];
}

export class Pyannote31Provider implements DiarizationProvider {
  public readonly name = 'pyannote-3.1';

  constructor(private readonly opts: Pyannote31ProviderOptions) {}

  async *diarize(
    input: DiarizeInput,
    opts?: DiarizeOptions,
  ): AsyncIterable<SpeakerSegment> {
    const fetcher = this.opts.fetchImpl ?? globalThis.fetch;
    if (!fetcher) throw new DiarizationError('fetch unavailable', 'NO_FETCH');
    const url = `${this.opts.endpoint.replace(/\/$/, '')}/diarize`;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.opts.apiKey) headers['authorization'] = `Bearer ${this.opts.apiKey}`;

    let body: string;
    if (input.kind === 'audio') {
      body = JSON.stringify({
        audio_b64: bufferToBase64(input.data),
        mime: input.mimeType,
        ...(opts?.numSpeakersHint ? { num_speakers: opts.numSpeakersHint } : {}),
      });
    } else {
      body = JSON.stringify({
        segments: input.segments,
        ...(opts?.numSpeakersHint ? { num_speakers: opts.numSpeakersHint } : {}),
      });
    }

    let res: Response;
    try {
      res = await fetcher(url, {
        method: 'POST',
        headers,
        body,
        ...(opts?.signal ? { signal: opts.signal } : {}),
      });
    } catch (err) {
      throw new DiarizationError('sidecar unreachable', 'NETWORK', err);
    }
    if (!res.ok) throw new DiarizationError(`sidecar HTTP ${res.status}`, 'HTTP_ERROR');
    const json = (await res.json()) as SidecarResponse;
    for (const raw of json.segments) {
      const parsed = SpeakerSegmentSchema.safeParse(raw);
      if (!parsed.success) {
        throw new DiarizationError('sidecar returned invalid segment', 'SCHEMA');
      }
      yield parsed.data;
    }
  }
}

function bufferToBase64(buf: Uint8Array): string {
  let s = '';
  for (let i = 0; i < buf.byteLength; i += 1) {
    s += String.fromCharCode(buf[i] ?? 0);
  }
  return globalThis.btoa(s);
}
