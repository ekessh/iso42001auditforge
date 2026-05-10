// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
import { describe, it, expect } from "vitest";
import { createPgStub } from "../src/pg-stub.js";

describe("@auditforge/test-helpers / pg-stub", () => {
  it("returns the first matching response", async () => {
    const pg = createPgStub({
      responses: [
        { match: /^select \* from engagements/i, rows: [{ id: "eng-1" }] },
        { match: /^select \* from findings/i, rows: [{ id: "f-1" }] },
      ],
    });
    const e = await pg.query<{ id: string }>("SELECT * FROM engagements");
    expect(e.rows).toEqual([{ id: "eng-1" }]);
  });

  it("returns empty rows when no response matches", async () => {
    const pg = createPgStub({ responses: [] });
    const r = await pg.query("SELECT 1");
    expect(r.rows).toEqual([]);
  });

  it("records every invocation with sql and args", async () => {
    const pg = createPgStub({ responses: [{ match: /./, rows: [] }] });
    await pg.query("SELECT $1", ["x"]);
    await pg.query("UPDATE t SET v=$1", ["y"]);
    const calls = pg.invocations();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ sql: "SELECT $1", args: ["x"] });
    expect(calls[1]).toEqual({ sql: "UPDATE t SET v=$1", args: ["y"] });
  });
});
