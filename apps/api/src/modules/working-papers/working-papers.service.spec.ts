// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { WorkingPapersRepository } from './working-papers.repository.js';
import { WorkingPapersService } from './working-papers.service.js';

const firm = '11111111-1111-1111-1111-111111111111';
const eng = '99999999-9999-9999-9999-999999999999';

describe('WorkingPapersService', () => {
  let svc: WorkingPapersService;
  beforeEach(() => {
    const repo = new WorkingPapersRepository({} as never, new TenancyAdapter());
    svc = new WorkingPapersService(repo);
  });

  it('creates a draft', async () => {
    const wp = await svc.create(firm, { engagementId: eng, title: 'WP-1', controlRef: 'A.6.2', bodyMarkdown: '', evidenceRefs: [] });
    expect(wp.status).toBe('draft');
    expect(wp.version).toBe(1);
  });

  it('submits and finalizes', async () => {
    const wp = await svc.create(firm, { engagementId: eng, title: 'WP-2', controlRef: 'A.7', bodyMarkdown: 'x', evidenceRefs: [] });
    const submitted = await svc.submitForReview(firm, wp.id);
    expect(submitted.status).toBe('in_review');
    const finalized = await svc.finalize(firm, wp.id);
    expect(finalized.status).toBe('final');
  });

  it('blocks update on final paper', async () => {
    const wp = await svc.create(firm, { engagementId: eng, title: 'WP-3', controlRef: 'A.8', bodyMarkdown: '', evidenceRefs: [] });
    await svc.finalize(firm, wp.id);
    await expect(svc.update(firm, wp.id, { title: 'change' })).rejects.toThrow();
  });

  it('increments version on update', async () => {
    const wp = await svc.create(firm, { engagementId: eng, title: 'WP-4', controlRef: 'A.9', bodyMarkdown: '', evidenceRefs: [] });
    const u = await svc.update(firm, wp.id, { bodyMarkdown: 'updated' });
    expect(u.version).toBe(2);
  });
});
