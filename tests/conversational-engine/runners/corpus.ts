// SPDX-License-Identifier: BUSL-1.1
/**
 * Corpus loader + shared types for the bench runners.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const ClaimSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
});

const AttrSchema = z.object({
  framework: z.string(),
  nodeId: z.string(),
  confidence: z.number().optional(),
  rationale: z.string().optional(),
});

const GroundTruthSchema = z.object({
  claims: z.array(ClaimSchema),
  primary_attributions: z.array(AttrSchema),
  supporting_attributions: z.array(AttrSchema),
  dismissed_false_positives: z.array(AttrSchema),
  contradicts: z.string().nullable(),
});

const EntrySchema = z.object({
  id: z.string(),
  answer: z.string(),
  ground_truth: GroundTruthSchema,
  audit_phase: z.enum(['S1', 'S2', 'Surv', 'Recert', 'Special', 'Readiness']),
  ai_system_kind: z.enum([
    'llm', 'predictive-ml', 'agent', 'rag_agent', 'multi-agent',
    'training-pipeline', 'mcp-server', 'vector-db',
  ]),
  tags: z.array(z.string()),
});

const CorpusFileSchema = z.object({
  version: z.string(),
  license: z.string(),
  note: z.string(),
  entries: z.array(EntrySchema),
});

export type CorpusEntry = z.infer<typeof EntrySchema>;
export type CorpusGroundTruthClaim = z.infer<typeof ClaimSchema>;
export type CorpusGroundTruthAttribution = z.infer<typeof AttrSchema>;
export type CorpusFile = z.infer<typeof CorpusFileSchema>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function corpusFilePath(): string {
  return join(__dirname, '..', 'corpus', 'synthetic-bootstrap.json');
}

export function baselinePath(): string {
  return join(__dirname, '..', 'baseline.json');
}

export function loadCorpus(): CorpusFile {
  const raw = readFileSync(corpusFilePath(), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  return CorpusFileSchema.parse(parsed);
}

/** Annex A family extraction: 'A.7.4' -> 'A.7'. */
export function annexFamily(nodeId: string): string {
  const m = /^(A\.\d+)/.exec(nodeId);
  return m ? m[1]! : nodeId;
}

export function isAnnexId(framework: string): boolean {
  return framework === 'ISO42001_AnnexA';
}

export function precision(tp: number, fp: number): number {
  return tp + fp === 0 ? 0 : tp / (tp + fp);
}
export function recall(tp: number, fn: number): number {
  return tp + fn === 0 ? 0 : tp / (tp + fn);
}
export function f1(p: number, r: number): number {
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

/** Normalize a triple for set comparison: trims and lowercases. */
export function tripleKey(c: CorpusGroundTruthClaim): string {
  return `${c.subject.trim().toLowerCase()}|${c.predicate.trim().toLowerCase()}|${c.object.trim().toLowerCase()}`;
}
