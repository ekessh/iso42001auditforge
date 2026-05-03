// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  CandidateFindingReadApi,
  type CandidateFindingReader,
  type SubjectRole,
} from '../src/index.js';
import type { CandidateFinding } from '../src/index.js';

const findingFixture: CandidateFinding = {
  id: '00000000-0000-4000-8000-000000000001',
  firmId: '00000000-0000-4000-8000-000000000aaa',
  engagementId: '00000000-0000-4000-8000-000000000bbb',
  type: 'minor_nc',
  draftStatement: 'Auditee did not provide objective evidence...',
  linkedClauses: ['6.1.2'],
  linkedControls: [],
  sourceClaimIds: ['c1'],
  sourceEpisodeIds: ['ep1'],
  confidence: 0.85,
  suggestedRootCausePrompts: ['process_design'],
  proposedSeverityRationale: 'mandatory + high severity',
  modelInvocationId: 'mi_test',
  status: 'pending',
  createdAt: '2026-05-03T10:00:00.000Z',
  decidedBy: null,
  decidedAt: null,
  dismissalReason: null,
  detectorId: 'detector.direct_conformity_gap.v1',
  promptTemplateVersion: 'nc_drafting.v1.0.0',
};

class StubReader implements CandidateFindingReader {
  calls = 0;
  async listByEngagement(): Promise<readonly CandidateFinding[]> {
    this.calls += 1;
    return [findingFixture];
  }
}

describe('Auditee invisibility invariant', () => {
  it('returns the candidate findings to auditor roles', async () => {
    const stub = new StubReader();
    const api = new CandidateFindingReadApi(stub);
    for (const role of ['auditor', 'lead_auditor', 'reviewer', 'admin'] as SubjectRole[]) {
      const out = await api.listForRole({
        engagementId: findingFixture.engagementId,
        firmId: findingFixture.firmId,
        subjectRole: role,
      });
      expect(out).toHaveLength(1);
    }
  });

  it('returns an empty list to auditee role and does not call the reader', async () => {
    const stub = new StubReader();
    const api = new CandidateFindingReadApi(stub);
    const before = stub.calls;
    const out = await api.listForRole({
      engagementId: findingFixture.engagementId,
      firmId: findingFixture.firmId,
      subjectRole: 'auditee',
    });
    expect(out).toEqual([]);
    expect(stub.calls).toBe(before);
  });
});
