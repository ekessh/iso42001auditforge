// SPDX-License-Identifier: BUSL-1.1
import type { AuditFileArchive } from './domain.js';

export interface RetentionDeps {
  listExpired(now: Date): Promise<AuditFileArchive[]>;
  delete(archive: AuditFileArchive): Promise<void>;
  ledgerEmit(eventType: string, payload: unknown): Promise<{ eventId: string }>;
}

export class ArchiveRetentionEnforcer {
  constructor(private readonly d: RetentionDeps) {}

  async run(now = new Date()): Promise<{ deleted: number }> {
    const expired = await this.d.listExpired(now);
    for (const archive of expired) {
      await this.d.delete(archive);
      await this.d.ledgerEmit('archive.retention_deleted', {
        archiveId: archive.id, engagementId: archive.engagementId,
        retainUntil: archive.retainUntil, deletedAt: now.toISOString(),
      });
    }
    return { deleted: expired.length };
  }
}
