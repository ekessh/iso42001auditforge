// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
import { describe, it, expect, beforeEach } from "vitest";
import {
  firmFixture,
  auditorFixture,
  engagementFixture,
  workingPaperFixture,
  findingFixture,
  resetFixtureCounter,
} from "../src/fixtures/index.js";

describe("@auditforge/test-helpers / fixtures", () => {
  beforeEach(() => resetFixtureCounter());

  it("produces unique ids by default", () => {
    const a = firmFixture();
    const b = firmFixture();
    expect(a.id).not.toBe(b.id);
  });

  it("respects type-safe overrides", () => {
    const f = engagementFixture({ mode: "readiness", airGapMode: true, cloudConsent: ["anthropic"] });
    expect(f.mode).toBe("readiness");
    expect(f.airGapMode).toBe(true);
    expect(f.cloudConsent).toEqual(["anthropic"]);
  });

  it("links auditor → firm via firmId override", () => {
    const firm = firmFixture();
    const a = auditorFixture({ firmId: firm.id });
    expect(a.firmId).toBe(firm.id);
  });

  it("creates a working paper attached to an engagement", () => {
    const eng = engagementFixture();
    const wp = workingPaperFixture({ engagementId: eng.id });
    expect(wp.engagementId).toBe(eng.id);
  });

  it("creates a candidate finding by default", () => {
    expect(findingFixture().status).toBe("candidate");
  });
});
