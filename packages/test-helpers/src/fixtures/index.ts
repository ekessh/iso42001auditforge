// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors

let counter = 0;
const nextId = (prefix: string): string => {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
};

export interface FirmFixture {
  id: string;
  name: string;
  createdAt: Date;
}
export interface AuditorFixture {
  id: string;
  firmId: string;
  email: string;
  role: "lead-auditor" | "auditor" | "peer-reviewer" | "auditee";
  createdAt: Date;
}
export interface EngagementFixture {
  id: string;
  firmId: string;
  name: string;
  scope: string;
  mode: "audit" | "readiness";
  airGapMode: boolean;
  cloudConsent: ReadonlyArray<string>;
  createdAt: Date;
}
export interface WorkingPaperFixture {
  id: string;
  engagementId: string;
  title: string;
  body: string;
  clauseRefs: ReadonlyArray<string>;
  createdAt: Date;
}
export interface FindingFixture {
  id: string;
  engagementId: string;
  status: "candidate" | "promoted" | "dismissed";
  clauseRef: string;
  description: string;
  severity: "minor" | "major" | "critical";
  createdAt: Date;
}

export const firmFixture = (over: Partial<FirmFixture> = {}): FirmFixture => ({
  id: nextId("firm"),
  name: "Acme Auditing Co.",
  createdAt: new Date("2026-01-15T09:00:00Z"),
  ...over,
});

export const auditorFixture = (over: Partial<AuditorFixture> = {}): AuditorFixture => ({
  id: nextId("auditor"),
  firmId: over.firmId ?? nextId("firm"),
  email: `auditor-${nextId("u")}@auditforge.test`,
  role: "lead-auditor",
  createdAt: new Date("2026-01-15T09:30:00Z"),
  ...over,
});

export const engagementFixture = (over: Partial<EngagementFixture> = {}): EngagementFixture => ({
  id: nextId("eng"),
  firmId: over.firmId ?? nextId("firm"),
  name: "ISO 42001 Stage 2 — AI Lifecycle",
  scope: "AI Model Lifecycle / Annex A",
  mode: "audit",
  airGapMode: false,
  cloudConsent: [],
  createdAt: new Date("2026-02-01T09:00:00Z"),
  ...over,
});

export const workingPaperFixture = (over: Partial<WorkingPaperFixture> = {}): WorkingPaperFixture => ({
  id: nextId("wp"),
  engagementId: over.engagementId ?? nextId("eng"),
  title: "WP-01 Data Governance",
  body: "Initial observations regarding clause 7.5 documented information.",
  clauseRefs: ["7.5", "A.6.2"],
  createdAt: new Date("2026-02-02T10:00:00Z"),
  ...over,
});

export const findingFixture = (over: Partial<FindingFixture> = {}): FindingFixture => ({
  id: nextId("find"),
  engagementId: over.engagementId ?? nextId("eng"),
  status: "candidate",
  clauseRef: "A.6.2",
  description: "AI System Inventory missing for two production models.",
  severity: "major",
  createdAt: new Date("2026-02-03T11:00:00Z"),
  ...over,
});

export const resetFixtureCounter = (): void => {
  counter = 0;
};
