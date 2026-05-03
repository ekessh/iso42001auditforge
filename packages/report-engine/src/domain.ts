// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  Sha256HexSchema,
  TenantContextSchema,
  UuidSchema,
} from '@auditforge/shared';

/**
 * Report types covered by this engine. Mapped 1:1 to Section 3.9 of the design.
 */
export const ReportTypeSchema = z.enum([
  'stage1',
  'stage2',
  'surveillance',
  'recertification',
  'findings_summary',
  'technical_annex',
  'cross_framework_annex',
]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const LocaleSchema = z
  .string()
  .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, { message: 'must be a BCP-47 locale' })
  .default('en');
export type Locale = z.infer<typeof LocaleSchema>;

/**
 * Verdict mirrors `@auditforge/working-papers`. Duplicated here to keep the
 * report engine independent at the type level (no circular dependency on a
 * package that has CRDT runtime dependencies).
 */
export const ReportVerdictSchema = z.enum([
  'conformant',
  'minor_nc',
  'major_nc',
  'ofi',
  'na',
]);
export type ReportVerdict = z.infer<typeof ReportVerdictSchema>;

export const FindingSchema = z.object({
  id: UuidSchema,
  number: NonEmptyStringSchema, // e.g. "NC-2026-014"
  type: z.enum(['major_nc', 'minor_nc', 'ofi']),
  clause: NonEmptyStringSchema, // e.g. "5.2", "A.5.4"
  title: NonEmptyStringSchema,
  statement: NonEmptyStringSchema,
  evidenceRefs: z.array(UuidSchema).default([]),
  rootCause: z.string().optional(),
  correctionDue: IsoDateSchema.optional(),
  status: z.enum(['open', 'closed', 'accepted']).default('open'),
});
export type Finding = z.infer<typeof FindingSchema>;

/**
 * Section element types — the intermediate representation that renderers
 * walk. JSON-serializable on purpose: it is a stable, diffable artifact.
 */
export const InlineSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  link: z.string().url().optional(),
});
export type Inline = z.infer<typeof InlineSchema>;

export const ParagraphBlockSchema = z.object({
  kind: z.literal('paragraph'),
  inlines: z.array(InlineSchema).min(1),
});
export const HeadingBlockSchema = z.object({
  kind: z.literal('heading'),
  level: z.number().int().min(1).max(6),
  text: NonEmptyStringSchema,
});
export const TableBlockSchema = z.object({
  kind: z.literal('table'),
  header: z.array(NonEmptyStringSchema),
  rows: z.array(z.array(z.string())),
});
export const ListBlockSchema = z.object({
  kind: z.literal('list'),
  ordered: z.boolean().default(false),
  items: z.array(NonEmptyStringSchema).min(1),
});
export const ImageBlockSchema = z.object({
  kind: z.literal('image'),
  src: NonEmptyStringSchema, // opaque ref the host resolves
  caption: z.string().optional(),
});
export const PageBreakBlockSchema = z.object({ kind: z.literal('pagebreak') });
export const SignatureBlockSchema = z.object({
  kind: z.literal('signature_block'),
  signers: z
    .array(
      z.object({
        role: z.enum(['lead_auditor', 'peer_reviewer', 'technical_expert']),
        nameVar: NonEmptyStringSchema, // template variable name
      }),
    )
    .min(1),
});

export const BlockSchema = z.discriminatedUnion('kind', [
  ParagraphBlockSchema,
  HeadingBlockSchema,
  TableBlockSchema,
  ListBlockSchema,
  ImageBlockSchema,
  PageBreakBlockSchema,
  SignatureBlockSchema,
]);
export type Block = z.infer<typeof BlockSchema>;

export const SectionSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  /** Raw template text with `{{var}}` and `{{#each list}}{{/each}}` blocks. */
  body: z.string(),
  required: z.boolean().default(true),
});
export type Section = z.infer<typeof SectionSchema>;

/**
 * A `ReportTemplate` is fully data-driven — JSON or YAML, externalized for
 * external-auditor review via PR diff.
 */
export const ReportTemplateSchema = z.object({
  id: NonEmptyStringSchema,
  type: ReportTypeSchema,
  /**
   * ISO 17021-1 sub-clause anchor: e.g. "9.4.1" (Stage 1) or "9.4.8" (Stage 2).
   */
  isoAnchor: NonEmptyStringSchema,
  version: NonEmptyStringSchema,
  defaultLocale: LocaleSchema,
  /** Variable schema as a JSON description (compiled to Zod at load). */
  variables: z.record(
    z.object({
      type: z.enum([
        'string',
        'date',
        'number',
        'boolean',
        'array',
        'object',
      ]),
      required: z.boolean().default(true),
      description: z.string().optional(),
      itemShape: z.record(z.string()).optional(), // declarative shape for arrays
    }),
  ),
  sections: z.array(SectionSchema).min(1),
});
export type ReportTemplate = z.infer<typeof ReportTemplateSchema>;

/**
 * Rendered intermediate representation — what renderers consume.
 * JSON-serializable, deterministic, and diffable.
 */
export const RenderArtifactSchema = z.object({
  templateId: NonEmptyStringSchema,
  templateType: ReportTypeSchema,
  locale: LocaleSchema,
  generatedAt: IsoDateSchema,
  /** Stable: derived from a sorted blob of variables + template version. */
  contentHash: Sha256HexSchema,
  blocks: z.array(BlockSchema),
});
export type RenderArtifact = z.infer<typeof RenderArtifactSchema>;

export const ReportInstanceSchema = z.object({
  id: UuidSchema,
  tenant: TenantContextSchema,
  templateId: NonEmptyStringSchema,
  type: ReportTypeSchema,
  status: z.enum(['draft', 'in_review', 'signed_final', 'archived']),
  versions: z.array(UuidSchema).min(1),
  signatures: z.array(UuidSchema).default([]),
  createdAt: IsoDateSchema,
});
export type ReportInstance = z.infer<typeof ReportInstanceSchema>;

/**
 * One immutable version of a draft. After `signed_final` we never mutate;
 * subsequent edits create a new draft branched from the final's hash.
 */
export const ReportVersionSchema = z.object({
  id: UuidSchema,
  reportId: UuidSchema,
  parentId: UuidSchema.nullable(),
  /** Hash of `(variables JSON || templateId || templateVersion)`. */
  contentHash: Sha256HexSchema,
  /** The fully resolved render artifact at save time. */
  artifact: RenderArtifactSchema,
  createdAt: IsoDateSchema,
  authorId: UuidSchema,
  isFinal: z.boolean().default(false),
});
export type ReportVersion = z.infer<typeof ReportVersionSchema>;
