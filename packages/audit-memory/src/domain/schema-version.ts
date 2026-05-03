// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { UuidSchema, NonEmptyStringSchema, IsoDateSchema } from '@auditforge/shared';

export const EntityTypeSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  schemaVersionId: UuidSchema,
  name: NonEmptyStringSchema,
  description: z.string().max(2000).default(''),
  createdAt: IsoDateSchema,
});
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const RelationTypeSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  schemaVersionId: UuidSchema,
  name: NonEmptyStringSchema,
  symmetric: z.boolean().default(false),
  description: z.string().max(2000).default(''),
  createdAt: IsoDateSchema,
});
export type RelationType = z.infer<typeof RelationTypeSchema>;

export const SchemaVersionStatusSchema = z.enum(['draft', 'frozen', 'archived']);
export type SchemaVersionStatus = z.infer<typeof SchemaVersionStatusSchema>;

export const SchemaVersionSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  name: NonEmptyStringSchema,
  status: SchemaVersionStatusSchema,
  parentVersionId: UuidSchema.nullable(),
  entityTypeNames: z.array(NonEmptyStringSchema),
  relationTypeNames: z.array(NonEmptyStringSchema),
  frozenAt: IsoDateSchema.nullable(),
  createdAt: IsoDateSchema,
});
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;
