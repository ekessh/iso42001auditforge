// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable } from '@nestjs/common';
import type postgres from 'postgres';
import type { PersistedSnapshot } from '@auditforge/working-papers';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { PG_CLIENT } from '../../db/db.module.js';

interface SnapshotRow {
  working_paper_id: string;
  firm_id: string;
  engagement_id: string;
  snapshot: Buffer;
  content_hash: string;
  captured_at: Date;
}

interface UpdateRow {
  id: string;
  working_paper_id: string;
  update_bytes: Buffer;
  occurred_at: Date;
}

@Injectable()
export class WorkingPapersSyncRepository extends BaseRepository {
  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  async loadEngagementForWp(
    firmId: string,
    workingPaperId: string,
  ): Promise<{ engagementId: string } | null> {
    return this.withTenant(async (tx) => {
      const rows = await tx<{ engagement_id: string }[]>`
        SELECT engagement_id FROM working_papers
        WHERE id = ${workingPaperId} AND firm_id = ${firmId}
        LIMIT 1
      `;
      const row = rows[0];
      return row ? { engagementId: row.engagement_id } : null;
    });
  }

  async loadSnapshot(
    firmId: string,
    workingPaperId: string,
  ): Promise<Uint8Array | null> {
    return this.withTenant(async (tx) => {
      const rows = await tx<SnapshotRow[]>`
        SELECT * FROM working_paper_snapshots
        WHERE working_paper_id = ${workingPaperId} AND firm_id = ${firmId}
        LIMIT 1
      `;
      const row = rows[0];
      return row ? new Uint8Array(row.snapshot) : null;
    });
  }

  async loadUpdatesAfter(
    firmId: string,
    workingPaperId: string,
    after: Date | null,
  ): Promise<Uint8Array[]> {
    return this.withTenant(async (tx) => {
      const rows = await tx<UpdateRow[]>`
        SELECT id, working_paper_id, update_bytes, occurred_at
        FROM working_paper_updates
        WHERE working_paper_id = ${workingPaperId}
          AND firm_id = ${firmId}
          ${after ? tx`AND occurred_at > ${after}` : tx``}
        ORDER BY occurred_at ASC
      `;
      return rows.map((r) => new Uint8Array(r.update_bytes));
    });
  }

  async appendUpdate(opts: {
    firmId: string;
    engagementId: string;
    workingPaperId: string;
    update: Uint8Array;
    auditorId: string;
  }): Promise<void> {
    await this.withTenant(async (tx) => {
      await tx`
        INSERT INTO working_paper_updates
          (working_paper_id, firm_id, engagement_id, update_bytes, auditor_id)
        VALUES (
          ${opts.workingPaperId},
          ${opts.firmId},
          ${opts.engagementId},
          ${Buffer.from(opts.update)},
          ${opts.auditorId}
        )
      `;
    });
  }

  async upsertSnapshot(opts: {
    firmId: string;
    engagementId: string;
    workingPaperId: string;
    snapshot: PersistedSnapshot;
  }): Promise<void> {
    const buf = Buffer.from(opts.snapshot.bytes);
    await this.withTenant(async (tx) => {
      await tx`
        INSERT INTO working_paper_snapshots
          (working_paper_id, firm_id, engagement_id, snapshot, content_hash, captured_at)
        VALUES (
          ${opts.workingPaperId},
          ${opts.firmId},
          ${opts.engagementId},
          ${buf},
          ${opts.snapshot.contentHash},
          now()
        )
        ON CONFLICT (working_paper_id) DO UPDATE
          SET snapshot = EXCLUDED.snapshot,
              content_hash = EXCLUDED.content_hash,
              captured_at = now()
      `;
    });
  }

  async deleteUpdatesBefore(
    firmId: string,
    workingPaperId: string,
    before: Date,
  ): Promise<number> {
    return this.withTenant(async (tx) => {
      const rows = await tx<{ count: number }[]>`
        WITH deleted AS (
          DELETE FROM working_paper_updates
          WHERE working_paper_id = ${workingPaperId}
            AND firm_id = ${firmId}
            AND occurred_at < ${before}
          RETURNING 1
        )
        SELECT count(*)::int AS count FROM deleted
      `;
      return rows[0]?.count ?? 0;
    });
  }
}
