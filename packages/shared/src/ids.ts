// SPDX-License-Identifier: BUSL-1.1
declare const __brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type Uuid = string;

export type FirmId = Brand<Uuid, 'FirmId'>;
export type AuditorId = Brand<Uuid, 'AuditorId'>;
export type ClientId = Brand<Uuid, 'ClientId'>;
export type EngagementId = Brand<Uuid, 'EngagementId'>;
export type AuditEventId = Brand<Uuid, 'AuditEventId'>;
export type WorkingPaperId = Brand<Uuid, 'WorkingPaperId'>;
export type FindingId = Brand<Uuid, 'FindingId'>;
export type EvidenceId = Brand<Uuid, 'EvidenceId'>;
export type AiSystemId = Brand<Uuid, 'AiSystemId'>;
export type AgentWorkflowId = Brand<Uuid, 'AgentWorkflowId'>;
export type ProbeDefinitionId = Brand<Uuid, 'ProbeDefinitionId'>;
export type ProbeExecutionId = Brand<Uuid, 'ProbeExecutionId'>;
export type LedgerEventId = Brand<Uuid, 'LedgerEventId'>;
export type RoleAssignmentId = Brand<Uuid, 'RoleAssignmentId'>;
export type ReportId = Brand<Uuid, 'ReportId'>;
export type SampleId = Brand<Uuid, 'SampleId'>;
export type InterviewId = Brand<Uuid, 'InterviewId'>;
export type CapaId = Brand<Uuid, 'CapaId'>;
export type SoaRecordId = Brand<Uuid, 'SoaRecordId'>;
export type AgentTraceId = Brand<Uuid, 'AgentTraceId'>;
export type ArchiveId = Brand<Uuid, 'ArchiveId'>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export function asFirmId(u: string): FirmId {
  if (!isUuid(u)) throw new TypeError(`asFirmId: not a UUID: ${u}`);
  return u as FirmId;
}
export function asAuditorId(u: string): AuditorId {
  if (!isUuid(u)) throw new TypeError(`asAuditorId: not a UUID: ${u}`);
  return u as AuditorId;
}
export function asClientId(u: string): ClientId {
  if (!isUuid(u)) throw new TypeError(`asClientId: not a UUID: ${u}`);
  return u as ClientId;
}
export function asEngagementId(u: string): EngagementId {
  if (!isUuid(u)) throw new TypeError(`asEngagementId: not a UUID: ${u}`);
  return u as EngagementId;
}

export function brandedFromUuid<B extends string>(u: string): Brand<Uuid, B> {
  if (!isUuid(u)) throw new TypeError(`brandedFromUuid: not a UUID: ${u}`);
  return u as Brand<Uuid, B>;
}
