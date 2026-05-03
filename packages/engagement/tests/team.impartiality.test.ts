// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import { evaluateImpartiality } from '../src/team/impartiality.js';
import {
  assertTeamHasLeadAuditor,
  assertNoDuplicateAssignments,
} from '../src/team/validation.js';
import type {
  AuditorId,
  ClientId,
  EngagementId,
} from '@auditforge/shared';
import type { AuditTeam, AuditorRelationship } from '../src/types/team.js';

const AUDITOR = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' as unknown as AuditorId;
const AUDITOR2 = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' as unknown as AuditorId;
const CLIENT = 'cccccccc-cccc-4ccc-cccc-cccccccccccc' as unknown as ClientId;
const ENG = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee' as unknown as EngagementId;
const NOW = '2026-05-03T00:00:00Z';

describe('evaluateImpartiality — golden cases', () => {
  it('clear when no relationships exist', () => {
    const r = evaluateImpartiality(AUDITOR, CLIENT, [], { now: NOW });
    expect(r.verdict).toBe('clear');
    expect(r.reasons).toHaveLength(0);
  });

  it('conflict if consulted within last 2 years (default)', () => {
    const rels: AuditorRelationship[] = [
      {
        auditorId: AUDITOR,
        clientId: CLIENT,
        kind: 'consulted_for_client',
        startedAt: '2024-09-01',
        endedAt: '2025-02-01',
        description: 'AIMS gap analysis consulting',
      },
    ];
    const r = evaluateImpartiality(AUDITOR, CLIENT, rels, { now: NOW });
    expect(r.verdict).toBe('conflict');
    expect(r.reasons[0]?.kind).toBe('consulted_for_client');
  });

  it('clear if consultancy is older than the lookback window', () => {
    const rels: AuditorRelationship[] = [
      {
        auditorId: AUDITOR,
        clientId: CLIENT,
        kind: 'consulted_for_client',
        startedAt: '2018-01-01',
        endedAt: '2018-06-01',
        description: 'Old engagement',
      },
    ];
    const r = evaluateImpartiality(AUDITOR, CLIENT, rels, { now: NOW });
    expect(r.verdict).toBe('clear');
  });

  it('configurable lookback widens window', () => {
    const rels: AuditorRelationship[] = [
      {
        auditorId: AUDITOR,
        clientId: CLIENT,
        kind: 'consulted_for_client',
        startedAt: '2022-01-01',
        endedAt: '2022-06-01',
        description: 'Long-ago consulting',
      },
    ];
    const clear = evaluateImpartiality(AUDITOR, CLIENT, rels, {
      now: NOW,
      lookbackYears: 2,
    });
    const conflict = evaluateImpartiality(AUDITOR, CLIENT, rels, {
      now: NOW,
      lookbackYears: 5,
    });
    expect(clear.verdict).toBe('clear');
    expect(conflict.verdict).toBe('conflict');
  });

  it('financial interest is always a conflict', () => {
    const rels: AuditorRelationship[] = [
      {
        auditorId: AUDITOR,
        clientId: CLIENT,
        kind: 'financial_interest',
        startedAt: '2010-01-01',
        description: 'Owns shares',
      },
    ];
    const r = evaluateImpartiality(AUDITOR, CLIENT, rels, { now: NOW });
    expect(r.verdict).toBe('conflict');
  });

  it('family relationship is always a conflict', () => {
    const rels: AuditorRelationship[] = [
      {
        auditorId: AUDITOR,
        clientId: CLIENT,
        kind: 'family_relationship',
        startedAt: '2010-01-01',
        description: 'Spouse works at client',
      },
    ];
    const r = evaluateImpartiality(AUDITOR, CLIENT, rels, { now: NOW });
    expect(r.verdict).toBe('conflict');
  });

  it('previous-audit rotation rule fires within 7 years (default)', () => {
    const rels: AuditorRelationship[] = [
      {
        auditorId: AUDITOR,
        clientId: CLIENT,
        kind: 'previous_audit_too_recent',
        startedAt: '2024-01-01',
        description: 'Last audit',
      },
    ];
    const r = evaluateImpartiality(AUDITOR, CLIENT, rels, { now: NOW });
    expect(r.verdict).toBe('conflict');
  });

  it('rotation rule does not fire after the configured gap', () => {
    const rels: AuditorRelationship[] = [
      {
        auditorId: AUDITOR,
        clientId: CLIENT,
        kind: 'previous_audit_too_recent',
        startedAt: '2014-01-01',
        description: 'Old audit',
      },
    ];
    const r = evaluateImpartiality(AUDITOR, CLIENT, rels, { now: NOW });
    expect(r.verdict).toBe('clear');
  });

  it('ignores relationships for other auditors / clients', () => {
    const rels: AuditorRelationship[] = [
      {
        auditorId: AUDITOR2,
        clientId: CLIENT,
        kind: 'consulted_for_client',
        startedAt: '2025-01-01',
        endedAt: '2025-06-01',
        description: 'Other auditor',
      },
    ];
    const r = evaluateImpartiality(AUDITOR, CLIENT, rels, { now: NOW });
    expect(r.verdict).toBe('clear');
  });

  it('ongoing employment without end date counts as recent', () => {
    const rels: AuditorRelationship[] = [
      {
        auditorId: AUDITOR,
        clientId: CLIENT,
        kind: 'employment_with_client',
        startedAt: '2010-01-01',
        description: 'Employed',
      },
    ];
    const r = evaluateImpartiality(AUDITOR, CLIENT, rels, { now: NOW });
    expect(r.verdict).toBe('conflict');
  });
});

describe('Audit team validation', () => {
  it('requires exactly one lead auditor', () => {
    const team: AuditTeam = {
      engagementId: ENG,
      assignments: [{ auditorId: AUDITOR, role: 'auditor' }],
    };
    expect(() => assertTeamHasLeadAuditor(team)).toThrow();
  });

  it('rejects two leads', () => {
    const team: AuditTeam = {
      engagementId: ENG,
      assignments: [
        { auditorId: AUDITOR, role: 'lead_auditor' },
        { auditorId: AUDITOR2, role: 'lead_auditor' },
      ],
    };
    expect(() => assertTeamHasLeadAuditor(team)).toThrow();
  });

  it('accepts one lead', () => {
    const team: AuditTeam = {
      engagementId: ENG,
      assignments: [
        { auditorId: AUDITOR, role: 'lead_auditor' },
        { auditorId: AUDITOR2, role: 'auditor' },
      ],
    };
    expect(() => assertTeamHasLeadAuditor(team)).not.toThrow();
  });

  it('rejects duplicate (auditor, role) pairs', () => {
    const team: AuditTeam = {
      engagementId: ENG,
      assignments: [
        { auditorId: AUDITOR, role: 'auditor' },
        { auditorId: AUDITOR, role: 'auditor' },
      ],
    };
    expect(() => assertNoDuplicateAssignments(team)).toThrow();
  });

  it('allows same auditor in different roles', () => {
    const team: AuditTeam = {
      engagementId: ENG,
      assignments: [
        { auditorId: AUDITOR, role: 'lead_auditor' },
        { auditorId: AUDITOR, role: 'technical_expert' },
      ],
    };
    expect(() => assertNoDuplicateAssignments(team)).not.toThrow();
  });
});
