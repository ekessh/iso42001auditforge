// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { EvidenceRepository } from './evidence-vault.repository.js';
import { EvidenceService } from './evidence-vault.service.js';
import type { AppConfig } from '../../config/config.schema.js';

const firm = '11111111-1111-1111-1111-111111111111';
const otherFirm = '22222222-2222-2222-2222-222222222222';

describe('EvidenceService', () => {
  let svc: EvidenceService;
  let avAdds: unknown[]; let ocrAdds: unknown[];

  beforeEach(() => {
    avAdds = []; ocrAdds = [];
    const repo = new EvidenceRepository({} as never, new TenancyAdapter());
    const storage = {
      presignUpload: vi.fn(async () => ({ uploadId: 'u', bucket: 'b', objectKey: 'k', url: 'http://x', expiresAt: '' })),
      presignDownload: vi.fn(async () => 'http://download'),
    } as unknown as ConstructorParameters<typeof EvidenceService>[1];
    const cfg = { S3_BUCKET: 'auditforge' } as AppConfig;
    const av = { add: vi.fn(async (n: string, d: unknown) => { avAdds.push({ n, d }); return {}; }) } as unknown as ConstructorParameters<typeof EvidenceService>[3];
    const ocr = { add: vi.fn(async (n: string, d: unknown) => { ocrAdds.push({ n, d }); return {}; }) } as unknown as ConstructorParameters<typeof EvidenceService>[4];
    svc = new EvidenceService(repo, storage, cfg, av, ocr);
  });

  const fixture = {
    uploadId: '00000000-0000-4000-8000-000000000001',
    objectKey: 'k',
    sha256: 'a'.repeat(64),
    filename: 'f.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 100,
  };

  it('presigns upload', async () => {
    const r = await svc.presign(firm, { filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1 });
    expect(r.url).toBe('http://x');
  });

  it('finalizes and enqueues AV + OCR for PDFs', async () => {
    const ev = await svc.finalize(firm, fixture);
    expect(ev.avStatus).toBe('uploaded');
    expect(avAdds).toHaveLength(1);
    expect(ocrAdds).toHaveLength(1);
  });

  it('does not enqueue OCR for non-PDF/image', async () => {
    await svc.finalize(firm, { ...fixture, mimeType: 'text/plain' });
    expect(ocrAdds).toHaveLength(0);
  });

  it('isolates between firms', async () => {
    const ev = await svc.finalize(firm, fixture);
    await expect(svc.get(otherFirm, ev.id)).rejects.toThrow();
  });

  it('signed download requires existing evidence', async () => {
    await expect(svc.signedDownload(firm, '00000000-0000-0000-0000-000000000000')).rejects.toThrow();
  });
});
