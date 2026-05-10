// SPDX-License-Identifier: BUSL-1.1

import { describe, it, expect } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { CandidateFindingsRepository } from '../candidate-findings/candidate-findings.repository.js';
import { CoverageRepository } from '../coverage/coverage.repository.js';
import { FindingsRepository } from '../findings/findings.repository.js';
import { AuditDashboardService } from './audit-dashboard.service.js';

const firm = '11111111-1111-1111-1111-111111111111';
const otherFirm = '22222222-2222-2222-2222-222222222222';
const eng = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

describe('AuditDashboardService', () => {
  it('builds a dashboard payload with coverage pct, candidate breakdown, and risk classification', async () => {
    const cov = new CoverageRepository({} as never, new TenancyAdapter());
    const fnd = new FindingsRepository({} as never, new TenancyAdapter());
    const cf = new CandidateFindingsRepository({} as never, new TenancyAdapter());
    cf.seed(firm, eng, { type: 'major' });
    cf.seed(firm, eng, { type: 'minor' });
    cf.seed(firm, eng, { type: 'ofi' });
    cf.seed(firm, eng, { type: 'observation' });
    const svc = new AuditDashboardService(cov, fnd, cf);
    const out = await svc.build(firm, eng);
    expect(out.candidateFindings.major).toBe(1);
    expect(out.candidateFindings.minor).toBe(1);
    expect(out.candidateFindings.ofi).toBe(1);
    expect(out.candidateFindings.observation).toBe(1);
    expect(out.areaBars).toHaveLength(1);
    expect(['on_track', 'coverage_gap', 'time_overrun']).toContain(out.risk);
  });

  it('isolates by firm — candidate findings seeded for one firm do not appear in another firms dashboard', async () => {
    const cov = new CoverageRepository({} as never, new TenancyAdapter());
    const fnd = new FindingsRepository({} as never, new TenancyAdapter());
    const cf = new CandidateFindingsRepository({} as never, new TenancyAdapter());
    cf.seed(firm, eng, { type: 'major' });
    const svc = new AuditDashboardService(cov, fnd, cf);
    const out = await svc.build(otherFirm, eng);
    expect(out.candidateFindings.major).toBe(0);
  });
});
