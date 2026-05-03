// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { ReportsRepository } from './reports.repository.js';
import { ReportsService } from './reports.service.js';

const firm = '11111111-1111-1111-1111-111111111111';
const eng = '99999999-9999-9999-9999-999999999999';

describe('ReportsService', () => {
  let svc: ReportsService;
  let renderAdds: number;
  beforeEach(() => {
    renderAdds = 0;
    const repo = new ReportsRepository({} as never, new TenancyAdapter());
    const queue = { add: vi.fn(async () => { renderAdds += 1; return { id: 'job-1' }; }) } as unknown as ConstructorParameters<typeof ReportsService>[1];
    svc = new ReportsService(repo, queue);
  });

  it('creates draft report', async () => {
    const r = await svc.create(firm, { engagementId: eng, kind: 'stage2', title: 'Stage 2', bodyMarkdown: '' });
    expect(r.status).toBe('draft');
    expect(r.version).toBe(1);
  });

  it('queues render', async () => {
    const r = await svc.create(firm, { engagementId: eng, kind: 'stage1', title: 'S1', bodyMarkdown: '' });
    const { jobId } = await svc.render(firm, r.id);
    expect(jobId).toBe('job-1');
    expect(renderAdds).toBe(1);
  });

  it('signs report and marks as issued', async () => {
    const r = await svc.create(firm, { engagementId: eng, kind: 'stage1', title: 'S1', bodyMarkdown: '' });
    const signed = await svc.sign(firm, r.id, 'auditor-1', { attestation: 'a'.repeat(32) });
    expect(signed.status).toBe('issued');
    expect(signed.signedBy).toBe('auditor-1');
    expect(signed.signatureRef).toMatch(/^[a-f0-9]{64}$/);
    expect(signed.issuedAt).toBeDefined();
  });

  it('rejects update on issued report', async () => {
    const r = await svc.create(firm, { engagementId: eng, kind: 'stage1', title: 'S1', bodyMarkdown: '' });
    await svc.sign(firm, r.id, 'auditor-1', { attestation: 'a'.repeat(32) });
    await expect(svc.update(firm, r.id, { title: 'changed' })).rejects.toThrow();
  });

  it('rejects double-sign', async () => {
    const r = await svc.create(firm, { engagementId: eng, kind: 'stage1', title: 'S1', bodyMarkdown: '' });
    await svc.sign(firm, r.id, 'auditor-1', { attestation: 'a'.repeat(32) });
    await expect(svc.sign(firm, r.id, 'auditor-1', { attestation: 'a'.repeat(32) })).rejects.toThrow();
  });
});
