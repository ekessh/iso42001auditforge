// SPDX-License-Identifier: BUSL-1.1
import { ValidationError } from '@auditforge/shared';
import {
  InterviewLibraryEntrySchema,
  type IndexableEntry,
  type InterviewLibraryEntry,
} from '../domain/entry.js';
import type {
  AiSystemClass,
  ApplicableMode,
  InterviewRole,
} from '../domain/role.js';
import bundled from '../data/interview-library.json' with { type: 'json' };

export interface LibraryFilter {
  readonly roles?: readonly InterviewRole[];
  readonly clauses?: readonly string[];
  readonly modes?: readonly ApplicableMode[];
  readonly aiSystemClasses?: readonly AiSystemClass[];
}

export class InterviewLibraryLoader {
  private readonly entries: readonly InterviewLibraryEntry[];
  private readonly byId: ReadonlyMap<string, InterviewLibraryEntry>;
  private readonly byRole: ReadonlyMap<InterviewRole, readonly InterviewLibraryEntry[]>;
  private readonly byClause: ReadonlyMap<string, readonly InterviewLibraryEntry[]>;

  private constructor(entries: readonly InterviewLibraryEntry[]) {
    this.entries = entries;
    const byId = new Map<string, InterviewLibraryEntry>();
    const byRole = new Map<InterviewRole, InterviewLibraryEntry[]>();
    const byClause = new Map<string, InterviewLibraryEntry[]>();
    for (const e of entries) {
      if (byId.has(e.id)) {
        throw new ValidationError(`Duplicate interview-library id: ${e.id}`, { id: e.id });
      }
      byId.set(e.id, e);
      const roleList = byRole.get(e.role) ?? [];
      roleList.push(e);
      byRole.set(e.role, roleList);
      for (const c of e.clauseRefs) {
        const clauseList = byClause.get(c) ?? [];
        clauseList.push(e);
        byClause.set(c, clauseList);
      }
    }
    this.byId = byId;
    this.byRole = new Map(
      Array.from(byRole.entries()).map(([k, v]) => [k, Object.freeze([...v])]),
    );
    this.byClause = new Map(
      Array.from(byClause.entries()).map(([k, v]) => [k, Object.freeze([...v])]),
    );
  }

  /** Load the bundled curated library. */
  static loadBundled(): InterviewLibraryLoader {
    return InterviewLibraryLoader.fromArray(bundled as unknown[]);
  }

  /** Validate and load from an arbitrary JSON array (e.g. CB customization). */
  static fromArray(input: readonly unknown[]): InterviewLibraryLoader {
    const parsed: InterviewLibraryEntry[] = [];
    for (let i = 0; i < input.length; i += 1) {
      const r = InterviewLibraryEntrySchema.safeParse(input[i]);
      if (!r.success) {
        throw new ValidationError(`interview-library entry ${i} failed validation`, {
          index: i,
          issues: r.error.issues,
        });
      }
      parsed.push(r.data);
    }
    return new InterviewLibraryLoader(parsed);
  }

  list(): readonly InterviewLibraryEntry[] {
    return this.entries;
  }

  getById(id: string): InterviewLibraryEntry | undefined {
    return this.byId.get(id);
  }

  byRoleList(role: InterviewRole): readonly InterviewLibraryEntry[] {
    return this.byRole.get(role) ?? [];
  }

  byClauseList(clauseRef: string): readonly InterviewLibraryEntry[] {
    return this.byClause.get(clauseRef) ?? [];
  }

  filter(f: LibraryFilter): readonly InterviewLibraryEntry[] {
    const wantsRoles = f.roles && f.roles.length > 0;
    const wantsClauses = f.clauses && f.clauses.length > 0;
    const wantsModes = f.modes && f.modes.length > 0;
    const wantsClass = f.aiSystemClasses && f.aiSystemClasses.length > 0;
    const out: InterviewLibraryEntry[] = [];
    for (const e of this.entries) {
      if (wantsRoles && !f.roles!.includes(e.role)) continue;
      if (wantsClauses && !e.clauseRefs.some((c) => f.clauses!.includes(c))) continue;
      if (
        wantsModes &&
        !e.applicableModes.some((m) => f.modes!.includes(m))
      )
        continue;
      if (
        wantsClass &&
        !e.aiSystemClasses.some((c) => c === 'any' || f.aiSystemClasses!.includes(c))
      )
        continue;
      out.push(e);
    }
    return out;
  }

  /** Indexable projection for `@auditforge/search`. */
  indexable(): readonly IndexableEntry[] {
    return this.entries.map((e) => ({
      id: e.id,
      text: [e.question, ...e.followUps].join('\n'),
      role: e.role,
      clauseRefs: [...e.clauseRefs],
      modes: [...e.applicableModes],
    }));
  }
}
