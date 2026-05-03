// SPDX-License-Identifier: BUSL-1.1
export const ROLES = [
  'super_admin',
  'firm_admin',
  'lead_auditor',
  'team_auditor',
  'technical_expert',
  'audit_manager',
  'peer_reviewer',
  'client_user',
  'accreditation_auditor',
] as const;
export type Role = (typeof ROLES)[number];

export const RESOURCES = [
  'firm',
  'auditor',
  'client',
  'engagement',
  'audit_plan',
  'working_paper',
  'evidence',
  'finding',
  'capa',
  'report',
  'probe_definition',
  'probe_execution',
  'agent_trace',
  'sample',
  'interview',
  'soa_record',
  'risk_register',
  'peer_review',
  'archive',
  'ledger_event',
  'billing',
  'surveillance_telemetry',
  'co_auditor_invocation',
  'ai_system',
  'agent_workflow',
  'catalogue',
] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'sign',
  'archive',
  'execute',
  'export',
  'import',
] as const;
export type Action = (typeof ACTIONS)[number];

export interface Permission {
  readonly role: Role;
  readonly resource: Resource;
  readonly action: Action;
  readonly scope: 'own' | 'firm' | 'engagement' | 'global' | 'none';
}

const NONE = 'none' as const;
const OWN = 'own' as const;
const FIRM = 'firm' as const;
const ENGAGEMENT = 'engagement' as const;
const GLOBAL = 'global' as const;

const SUPER_ADMIN_DEFAULT = GLOBAL;

const matrix: Record<Role, Partial<Record<Resource, Partial<Record<Action, Permission['scope']>>>>> = {
  super_admin: {} as Record<Resource, Partial<Record<Action, Permission['scope']>>>,
  firm_admin: {
    firm: { read: FIRM, update: FIRM, export: FIRM },
    auditor: { create: FIRM, read: FIRM, update: FIRM, delete: FIRM },
    client: { create: FIRM, read: FIRM, update: FIRM, delete: FIRM },
    engagement: { create: FIRM, read: FIRM, update: FIRM, delete: FIRM, archive: FIRM, export: FIRM },
    audit_plan: { read: FIRM, update: FIRM, export: FIRM },
    working_paper: { read: FIRM },
    evidence: { read: FIRM, export: FIRM },
    finding: { read: FIRM, export: FIRM },
    capa: { read: FIRM },
    report: { read: FIRM, export: FIRM },
    probe_definition: { create: FIRM, read: FIRM, update: FIRM, delete: FIRM },
    probe_execution: { read: FIRM },
    agent_trace: { read: FIRM },
    sample: { read: FIRM },
    interview: { read: FIRM },
    soa_record: { read: FIRM },
    risk_register: { read: FIRM },
    peer_review: { read: FIRM },
    archive: { read: FIRM, export: FIRM },
    ledger_event: { read: FIRM, export: FIRM },
    billing: { create: FIRM, read: FIRM, update: FIRM, export: FIRM },
    surveillance_telemetry: { read: FIRM },
    co_auditor_invocation: { read: FIRM },
    ai_system: { read: FIRM },
    agent_workflow: { read: FIRM },
    catalogue: { read: GLOBAL },
  },
  lead_auditor: {
    firm: { read: FIRM },
    auditor: { read: FIRM },
    client: { read: FIRM, update: ENGAGEMENT },
    engagement: { create: FIRM, read: ENGAGEMENT, update: ENGAGEMENT, archive: ENGAGEMENT, export: ENGAGEMENT },
    audit_plan: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT, export: ENGAGEMENT, sign: ENGAGEMENT },
    working_paper: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT, delete: ENGAGEMENT, sign: ENGAGEMENT },
    evidence: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT, delete: ENGAGEMENT, export: ENGAGEMENT },
    finding: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT, delete: ENGAGEMENT, sign: ENGAGEMENT, export: ENGAGEMENT },
    capa: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT },
    report: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT, sign: ENGAGEMENT, export: ENGAGEMENT },
    probe_definition: { read: FIRM },
    probe_execution: { create: ENGAGEMENT, read: ENGAGEMENT, execute: ENGAGEMENT },
    agent_trace: { create: ENGAGEMENT, read: ENGAGEMENT, import: ENGAGEMENT },
    sample: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT },
    interview: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT },
    soa_record: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT, import: ENGAGEMENT },
    risk_register: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT, import: ENGAGEMENT },
    peer_review: { read: ENGAGEMENT },
    archive: { read: ENGAGEMENT, export: ENGAGEMENT },
    ledger_event: { read: ENGAGEMENT },
    billing: { create: OWN, read: OWN, update: OWN },
    surveillance_telemetry: { read: ENGAGEMENT },
    co_auditor_invocation: { create: ENGAGEMENT, read: ENGAGEMENT, execute: ENGAGEMENT },
    ai_system: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT },
    agent_workflow: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT, import: ENGAGEMENT },
    catalogue: { read: GLOBAL },
  },
  team_auditor: {
    firm: { read: FIRM },
    auditor: { read: FIRM },
    client: { read: ENGAGEMENT },
    engagement: { read: ENGAGEMENT },
    audit_plan: { read: ENGAGEMENT },
    working_paper: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT },
    evidence: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT },
    finding: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT },
    capa: { read: ENGAGEMENT },
    report: { read: ENGAGEMENT },
    probe_definition: { read: FIRM },
    probe_execution: { read: ENGAGEMENT },
    agent_trace: { read: ENGAGEMENT },
    sample: { read: ENGAGEMENT, update: ENGAGEMENT },
    interview: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT },
    soa_record: { read: ENGAGEMENT },
    risk_register: { read: ENGAGEMENT },
    peer_review: { read: NONE },
    archive: { read: NONE },
    ledger_event: { read: ENGAGEMENT },
    billing: { create: OWN, read: OWN, update: OWN },
    surveillance_telemetry: { read: NONE },
    co_auditor_invocation: { create: ENGAGEMENT, read: ENGAGEMENT, execute: ENGAGEMENT },
    ai_system: { read: ENGAGEMENT },
    agent_workflow: { read: ENGAGEMENT },
    catalogue: { read: GLOBAL },
  },
  technical_expert: {
    firm: { read: FIRM },
    auditor: { read: FIRM },
    client: { read: ENGAGEMENT },
    engagement: { read: ENGAGEMENT },
    audit_plan: { read: ENGAGEMENT },
    working_paper: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT },
    evidence: { create: ENGAGEMENT, read: ENGAGEMENT },
    finding: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT },
    capa: { read: ENGAGEMENT },
    report: { read: ENGAGEMENT },
    probe_definition: { create: FIRM, read: FIRM, update: FIRM },
    probe_execution: { create: ENGAGEMENT, read: ENGAGEMENT, execute: ENGAGEMENT },
    agent_trace: { create: ENGAGEMENT, read: ENGAGEMENT, import: ENGAGEMENT },
    sample: { read: ENGAGEMENT },
    interview: { read: ENGAGEMENT, update: ENGAGEMENT },
    soa_record: { read: ENGAGEMENT },
    risk_register: { read: ENGAGEMENT },
    peer_review: { read: NONE },
    archive: { read: NONE },
    ledger_event: { read: ENGAGEMENT },
    billing: { create: OWN, read: OWN, update: OWN },
    surveillance_telemetry: { read: ENGAGEMENT },
    co_auditor_invocation: { create: ENGAGEMENT, read: ENGAGEMENT, execute: ENGAGEMENT },
    ai_system: { read: ENGAGEMENT, update: ENGAGEMENT },
    agent_workflow: { read: ENGAGEMENT, update: ENGAGEMENT, import: ENGAGEMENT },
    catalogue: { read: GLOBAL },
  },
  audit_manager: {
    firm: { read: FIRM },
    auditor: { read: FIRM, update: FIRM },
    client: { read: FIRM, update: FIRM },
    engagement: { create: FIRM, read: FIRM, update: FIRM, archive: FIRM, export: FIRM },
    audit_plan: { read: FIRM, update: FIRM, export: FIRM },
    working_paper: { read: FIRM },
    evidence: { read: FIRM },
    finding: { read: FIRM },
    capa: { read: FIRM },
    report: { read: FIRM, export: FIRM },
    probe_definition: { read: FIRM, update: FIRM },
    probe_execution: { read: FIRM },
    agent_trace: { read: FIRM },
    sample: { read: FIRM },
    interview: { read: FIRM },
    soa_record: { read: FIRM },
    risk_register: { read: FIRM },
    peer_review: { create: FIRM, read: FIRM, update: FIRM },
    archive: { read: FIRM, export: FIRM },
    ledger_event: { read: FIRM },
    billing: { read: FIRM },
    surveillance_telemetry: { read: FIRM },
    co_auditor_invocation: { read: FIRM },
    ai_system: { read: FIRM },
    agent_workflow: { read: FIRM },
    catalogue: { read: GLOBAL },
  },
  peer_reviewer: {
    firm: { read: FIRM },
    auditor: { read: FIRM },
    client: { read: ENGAGEMENT },
    engagement: { read: ENGAGEMENT },
    audit_plan: { read: ENGAGEMENT },
    working_paper: { read: ENGAGEMENT },
    evidence: { read: ENGAGEMENT },
    finding: { read: ENGAGEMENT },
    capa: { read: ENGAGEMENT },
    report: { read: ENGAGEMENT },
    probe_definition: { read: FIRM },
    probe_execution: { read: ENGAGEMENT },
    agent_trace: { read: ENGAGEMENT },
    sample: { read: ENGAGEMENT },
    interview: { read: ENGAGEMENT },
    soa_record: { read: ENGAGEMENT },
    risk_register: { read: ENGAGEMENT },
    peer_review: { create: ENGAGEMENT, read: ENGAGEMENT, update: ENGAGEMENT, sign: ENGAGEMENT },
    archive: { read: ENGAGEMENT },
    ledger_event: { read: ENGAGEMENT },
    billing: { create: OWN, read: OWN, update: OWN },
    surveillance_telemetry: { read: NONE },
    co_auditor_invocation: { read: ENGAGEMENT },
    ai_system: { read: ENGAGEMENT },
    agent_workflow: { read: ENGAGEMENT },
    catalogue: { read: GLOBAL },
  },
  client_user: {
    firm: { read: NONE },
    auditor: { read: NONE },
    client: { read: OWN },
    engagement: { read: OWN },
    audit_plan: { read: OWN },
    working_paper: { read: NONE },
    evidence: { create: OWN, read: OWN },
    finding: { read: OWN },
    capa: { create: OWN, read: OWN, update: OWN },
    report: { read: OWN, export: OWN },
    probe_definition: { read: NONE },
    probe_execution: { read: NONE },
    agent_trace: { read: NONE },
    sample: { read: NONE },
    interview: { read: NONE },
    soa_record: { read: OWN, import: OWN, update: OWN },
    risk_register: { read: OWN, import: OWN, update: OWN },
    peer_review: { read: NONE },
    archive: { read: NONE },
    ledger_event: { read: NONE },
    billing: { read: NONE },
    surveillance_telemetry: { create: OWN, read: OWN },
    co_auditor_invocation: { read: NONE },
    ai_system: { create: OWN, read: OWN, update: OWN },
    agent_workflow: { create: OWN, read: OWN, update: OWN, import: OWN },
    catalogue: { read: GLOBAL },
  },
  accreditation_auditor: {
    firm: { read: GLOBAL },
    auditor: { read: GLOBAL },
    client: { read: GLOBAL },
    engagement: { read: GLOBAL },
    audit_plan: { read: GLOBAL },
    working_paper: { read: GLOBAL },
    evidence: { read: GLOBAL },
    finding: { read: GLOBAL },
    capa: { read: GLOBAL },
    report: { read: GLOBAL, export: GLOBAL },
    probe_definition: { read: GLOBAL },
    probe_execution: { read: GLOBAL },
    agent_trace: { read: GLOBAL },
    sample: { read: GLOBAL },
    interview: { read: GLOBAL },
    soa_record: { read: GLOBAL },
    risk_register: { read: GLOBAL },
    peer_review: { read: GLOBAL },
    archive: { read: GLOBAL, export: GLOBAL },
    ledger_event: { read: GLOBAL },
    billing: { read: NONE },
    surveillance_telemetry: { read: GLOBAL },
    co_auditor_invocation: { read: GLOBAL },
    ai_system: { read: GLOBAL },
    agent_workflow: { read: GLOBAL },
    catalogue: { read: GLOBAL },
  },
};

export function permissionScope(role: Role, resource: Resource, action: Action): Permission['scope'] {
  if (role === 'super_admin') return SUPER_ADMIN_DEFAULT;
  const r = matrix[role][resource];
  if (!r) return NONE;
  return r[action] ?? NONE;
}

export function can(role: Role, action: Action, resource: Resource): boolean {
  return permissionScope(role, resource, action) !== NONE;
}

export function canScope(role: Role, action: Action, resource: Resource): Permission['scope'] {
  return permissionScope(role, resource, action);
}

export function buildFullPermissionMatrix(): Permission[] {
  const out: Permission[] = [];
  for (const role of ROLES) {
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        out.push({ role, resource, action, scope: permissionScope(role, resource, action) });
      }
    }
  }
  return out;
}
