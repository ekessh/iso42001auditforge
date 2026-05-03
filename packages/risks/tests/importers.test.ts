// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { importJson, importCsvRows } from '../src/importers.js';

const valid = {
  id: '00000000-0000-0000-0000-000000000001',
  firmId: '00000000-0000-0000-0000-000000000002',
  engagementId: '00000000-0000-0000-0000-000000000003',
  ownerOrg: 'AcmeCorp',
  riskTitle: 'PII leakage',
  description: 'Model leaks PII via output.',
  category: 'privacy',
  likelihood: 3, impact: 5, inherentScore: 15,
  controls: ['scrubber', 'output filter'],
};

describe('risks importers', () => {
  it('imports valid JSON', () => {
    const r = importJson([valid]);
    expect(r.entries).toHaveLength(1);
    expect(r.report.errors).toHaveLength(0);
  });
  it('reports invalid rows', () => {
    const r = importJson([{ ...valid, likelihood: 99 }]);
    expect(r.entries).toHaveLength(0);
    expect(r.report.errors).toHaveLength(1);
  });
  it('CSV row coercion', () => {
    const r = importCsvRows([{
      id: valid.id, firmId: valid.firmId, engagementId: valid.engagementId,
      ownerOrg: valid.ownerOrg, riskTitle: valid.riskTitle, description: valid.description,
      category: 'privacy',
      likelihood: '3', impact: '5', inherentScore: '15',
      controls: 'scrubber|output filter',
    }]);
    expect(r.entries).toHaveLength(1);
  });
});
