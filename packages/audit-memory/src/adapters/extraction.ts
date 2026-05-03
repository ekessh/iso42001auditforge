// SPDX-License-Identifier: BUSL-1.1
import type { Episode } from '../domain/episode.js';
import type { Claim } from '../domain/claim.js';
import type { SchemaVersion } from '../domain/schema-version.js';

export interface ExtractionResult {
  claims: Claim[];
  rejections: { reason: string; raw: unknown }[];
  modelInvocationId: string;
}

export interface ExtractionAdapter {
  extract(episode: Episode, schema: SchemaVersion): Promise<ExtractionResult>;
}
