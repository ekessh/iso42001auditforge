// SPDX-License-Identifier: BUSL-1.1

import { describe, it, expect } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { CandidateFindingsRepository } from '../candidate-findings/candidate-findings.repository.js';
import { CoverageRepository } from '../coverage/coverage.repository.js';
import { ReadinessService } from './readiness.service.js';
import { READINESS_DISCLAIMER } from './dto.js';

const firm = '11111111-1111-1111-1111-111111111111';
const otherFirm = '22222222-2222-2222-2222-222222222222';
const eng = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

describe('ReadinessService', () => {
  it('returns the mode + disclaimer fields per CLAUDE.md Termination Semantics', async () => {
    const cov = new CoverageRepository({} as never, new TenancyAdapter());
    const cf = new CandidateFindingsRepository({} as never, new TenancyAdapter());
    const svc = new ReadinessService(cov, cf);
    const out = await svc.build(firm, eng);
    expect(out.mode).toBe('readiness');
    expect(out.disclaimer).toBe(READINESS_DISCLAIMER);
    expect(out.weights.mandatory).toBe(1.5);
    expect(out.weights.annexA).toBe(1.0);
  });

  it('isolates by firm — open items seeded for one firm do not leak into another', async () => {
    const cov = new CoverageRepository({} as never, new TenancyAdapter());
    const cf = new CandidateFindingsRepository({} as never, new TenancyAdapter());
    cf.seed(firm, eng, { type: 'major', statement: 'Leak' });
    const svc = new ReadinessService(cov, cf);
    const out = await svc.build(otherFirm, eng);
    expect(out.openItems.length).toBe(0);
  });
});
