// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { FindingsRepository } from './findings.repository.js';
import { FindingsService } from './findings.service.js';

const firm = '11111111-1111-1111-1111-111111111111';
const eng = '99999999-9999-9999-9999-999999999999';

describe('FindingsService', () => {
  let svc: FindingsService;
  beforeEach(() => {
    const repo = new FindingsRepository({} as never, new TenancyAdapter());
    svc = new FindingsService(repo);
  });

  it('major NC starts in capa_pending', async () => {
    const f = await svc.create(firm, { engagementId: eng, controlRef: 'A.6.2', severity: 'major_nc', title: 't', description: 'd', evidence: [] });
    expect(f.status).toBe('capa_pending');
  });

  it('OFI starts open', async () => {
    const f = await svc.create(firm, { engagementId: eng, controlRef: 'A.7', severity: 'ofi', title: 't', description: 'd', evidence: [] });
    expect(f.status).toBe('open');
  });

  it('rejects illegal transition', async () => {
    const f = await svc.create(firm, { engagementId: eng, controlRef: 'A.7', severity: 'minor_nc', title: 't', description: 'd', evidence: [] });
    await expect(svc.transition(firm, f.id, 'verified')).rejects.toThrow();
  });

  it('happy-path transition closed→verified', async () => {
    const f = await svc.create(firm, { engagementId: eng, controlRef: 'A.7', severity: 'minor_nc', title: 't', description: 'd', evidence: [] });
    const t1 = await svc.transition(firm, f.id, 'capa_in_progress');
    expect(t1.status).toBe('capa_in_progress');
    const t2 = await svc.transition(firm, f.id, 'closed');
    expect(t2.status).toBe('closed');
    const t3 = await svc.transition(firm, f.id, 'verified');
    expect(t3.status).toBe('verified');
  });
});
