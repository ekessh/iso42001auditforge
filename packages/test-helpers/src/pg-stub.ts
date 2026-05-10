// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors

/**
 * Minimal postgres-js compatible stub used by repository unit tests.
 * Records every invocation; replays predefined results.
 *
 * Extracted from the Wave-1 pattern in
 * apps/api/src/modules/clients/clients.repository.spec.ts so multiple
 * repositories can share one factory.
 */

export type SqlArg = unknown;

export interface PgInvocation {
  readonly sql: string;
  readonly args: ReadonlyArray<SqlArg>;
}

export interface PgStubOptions {
  /**
   * Map of regex-source → row[] result (or a function returning rows).
   * The first matching regex wins.
   */
  readonly responses: ReadonlyArray<{
    readonly match: RegExp;
    readonly rows: ReadonlyArray<unknown> | ((sql: string, args: ReadonlyArray<SqlArg>) => ReadonlyArray<unknown>);
  }>;
}

export interface PgStub {
  readonly query: <T = unknown>(sql: string, args?: ReadonlyArray<SqlArg>) => Promise<{ rows: ReadonlyArray<T> }>;
  readonly invocations: () => ReadonlyArray<PgInvocation>;
  readonly reset: () => void;
}

export const createPgStub = (opts: PgStubOptions): PgStub => {
  const recorded: PgInvocation[] = [];

  return {
    query: async <T>(sql: string, args: ReadonlyArray<SqlArg> = []): Promise<{ rows: ReadonlyArray<T> }> => {
      recorded.push({ sql, args });
      const matched = opts.responses.find((r) => r.match.test(sql));
      if (!matched) return { rows: [] as ReadonlyArray<T> };
      const rows = typeof matched.rows === "function" ? matched.rows(sql, args) : matched.rows;
      return { rows: rows as ReadonlyArray<T> };
    },
    invocations: () => [...recorded],
    reset: () => {
      recorded.length = 0;
    },
  };
};
