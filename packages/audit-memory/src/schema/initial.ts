// SPDX-License-Identifier: BUSL-1.1

export const ENTITY_TYPES = [
  'AISystem',
  'Auditee',
  'AuditorClaim',
  'Process',
  'Control',
  'Evidence',
  'Stakeholder',
  'DataFlow',
  'Risk',
  'Incident',
  'Tool',
  'Vendor',
  'Dataset',
  'Model',
  'AgentWorkflow',
] as const;

export type EntityTypeName = (typeof ENTITY_TYPES)[number];

export const RELATION_TYPES = [
  'covers',
  'evidences',
  'contradicts',
  'supersedes',
  'supports',
  'applies_to',
  'owned_by',
  'processes',
  'feeds',
  'monitors',
  'reviews',
  'escalates_to',
  'depends_on',
] as const;

export type RelationTypeName = (typeof RELATION_TYPES)[number];

export const CONTRADICTION_RELATION: RelationTypeName = 'contradicts';
export const SUPERSEDES_RELATION: RelationTypeName = 'supersedes';
export const SUPPORTS_RELATION: RelationTypeName = 'supports';

export const INITIAL_SCHEMA_VERSION_NAME = 'initial-v1';
