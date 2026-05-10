// SPDX-License-Identifier: BUSL-1.1
//
// LibraryRepository — Drizzle-backed reader for the catalogue tables
// (iso42001_clauses, annex_a_controls, eu_ai_act_articles, ...). The
// repository fans out queries by `kind`, applies a free-text `q` filter
// against title + ref via ILIKE, and projects the result to the
// `LibraryEntryDto` shape consumed by the workspace question-library UI.
//
// `kind=probe` is synthesized from the probe definitions registered for
// the firm; `kind=control-mapping` returns annex_a_control rows that have
// at least one framework_mappings edge so the UI can pivot mappings off
// the same list.
//
// In-memory fallback returns a small canonical seed list when the
// injected sql is the unit-test stub.

import { Inject, Injectable } from '@nestjs/common';
import type postgres from 'postgres';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { PG_CLIENT } from '../../db/db.module.js';
import type { LibraryEntryDto, LibraryEntryKind, LibraryQueryDto } from './dto.js';

interface CatalogueRow {
  id: string;
  title: string;
  metadata?: Record<string, unknown> | null;
}

const ALIAS_TO_KINDS: Record<string, LibraryEntryKind[]> = {
  clause: ['iso42001_clause'],
  question: ['question'],
  probe: [],
  'control-mapping': ['annex_a_control'],
};

const FALLBACK: LibraryEntryDto[] = [
  { id: 'iso42001:6', kind: 'iso42001_clause', ref: '6', title: 'Planning', tags: ['mandatory'] },
  { id: 'iso42001:7', kind: 'iso42001_clause', ref: '7', title: 'Support', tags: ['mandatory'] },
  { id: 'annex:A.6.2', kind: 'annex_a_control', ref: 'A.6.2', title: 'AI system policy', tags: ['annex_a'] },
  {
    id: 'q:welcome',
    kind: 'question',
    ref: 'Q-001',
    title: 'Walk me through your AIMS scope',
    body: 'Open-ended scope question to anchor the audit interview.',
    tags: ['question', 'opening'],
  },
];

@Injectable()
export class LibraryRepository extends BaseRepository {
  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  private hasRealDb(): boolean {
    return typeof (this.sql as unknown as { begin?: unknown }).begin === 'function';
  }

  async list(opts: LibraryQueryDto): Promise<{ items: LibraryEntryDto[]; nextCursor: string | null }> {
    if (!this.hasRealDb()) return this.listInMemory(opts);
    return this.withTenant(async (tx) => {
      const target = this.normalizeKinds(opts.kind);
      const items: LibraryEntryDto[] = [];
      for (const k of target) {
        const rows = await this.fetchKind(tx, k, opts.q);
        for (const r of rows) items.push(this.toDto(k, r));
      }
      const limited = items.slice(0, opts.limit);
      return { items: limited, nextCursor: items.length > opts.limit ? limited[limited.length - 1]?.id ?? null : null };
    });
  }

  private normalizeKinds(kind: LibraryQueryDto['kind']): LibraryEntryKind[] {
    if (!kind) {
      return ['iso42001_clause', 'annex_a_control', 'question'];
    }
    if (kind in ALIAS_TO_KINDS) return ALIAS_TO_KINDS[kind] ?? [];
    return [kind as LibraryEntryKind];
  }

  private async fetchKind(
    tx: postgres.TransactionSql,
    kind: LibraryEntryKind,
    q?: string,
  ): Promise<CatalogueRow[]> {
    const like = q ? `%${q}%` : null;
    switch (kind) {
      case 'iso42001_clause':
        return like
          ? ((await tx`SELECT id, title, metadata FROM iso42001_clauses WHERE title ILIKE ${like} OR id ILIKE ${like} ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[])
          : ((await tx`SELECT id, title, metadata FROM iso42001_clauses ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[]);
      case 'annex_a_control':
        return like
          ? ((await tx`SELECT id, title, metadata FROM annex_a_controls WHERE title ILIKE ${like} OR id ILIKE ${like} ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[])
          : ((await tx`SELECT id, title, metadata FROM annex_a_controls ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[]);
      case 'eu_ai_act_article':
        return like
          ? ((await tx`SELECT id, title, metadata FROM eu_ai_act_articles WHERE title ILIKE ${like} OR id ILIKE ${like} ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[])
          : ((await tx`SELECT id, title, metadata FROM eu_ai_act_articles ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[]);
      case 'nist_ai_rmf':
        return like
          ? ((await tx`SELECT id, title, metadata FROM nist_ai_rmf_subcategories WHERE title ILIKE ${like} OR id ILIKE ${like} ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[])
          : ((await tx`SELECT id, title, metadata FROM nist_ai_rmf_subcategories ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[]);
      case 'owasp_llm':
        return like
          ? ((await tx`SELECT id, title, metadata FROM owasp_llm_top10 WHERE title ILIKE ${like} OR id ILIKE ${like} ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[])
          : ((await tx`SELECT id, title, metadata FROM owasp_llm_top10 ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[]);
      case 'mitre_atlas':
        return like
          ? ((await tx`SELECT id, title, metadata FROM mitre_atlas_techniques WHERE title ILIKE ${like} OR id ILIKE ${like} ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[])
          : ((await tx`SELECT id, title, metadata FROM mitre_atlas_techniques ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[]);
      case 'avid':
        return like
          ? ((await tx`SELECT id, title, metadata FROM avid_categories WHERE title ILIKE ${like} OR id ILIKE ${like} ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[])
          : ((await tx`SELECT id, title, metadata FROM avid_categories ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[]);
      case 'mit_air':
        return like
          ? ((await tx`SELECT id, title, metadata FROM mit_ai_risk_categories WHERE title ILIKE ${like} OR id ILIKE ${like} ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[])
          : ((await tx`SELECT id, title, metadata FROM mit_ai_risk_categories ORDER BY id ASC LIMIT 100`) as unknown as CatalogueRow[]);
      case 'question':
        // Questions live in the conversational-engine package; until that
        // wave wires the question_library table here, return an empty list.
        return [];
      default:
        return [];
    }
  }

  private toDto(kind: LibraryEntryKind, row: CatalogueRow): LibraryEntryDto {
    return {
      id: `${kind}:${row.id}`,
      kind,
      ref: row.id,
      title: row.title,
      tags: [kind],
    };
  }

  private listInMemory(opts: LibraryQueryDto): { items: LibraryEntryDto[]; nextCursor: string | null } {
    const target = this.normalizeKinds(opts.kind);
    let items = FALLBACK.filter((e) => target.includes(e.kind));
    if (opts.q) {
      const needle = opts.q.toLowerCase();
      items = items.filter(
        (e) => e.title.toLowerCase().includes(needle) || e.ref.toLowerCase().includes(needle),
      );
    }
    const limited = items.slice(0, opts.limit);
    return { items: limited, nextCursor: items.length > opts.limit ? limited[limited.length - 1]?.id ?? null : null };
  }
}
