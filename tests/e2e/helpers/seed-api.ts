// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/**
 * Seed test data via the internal /api/v1/test/seed endpoint.
 * Endpoint is only enabled when TEST_SEED_ENDPOINT_ENABLED=true.
 */

interface SeedOptions {
  apiUrl: string;
  adminEmail: string;
  adminPassword: string;
}

export async function seedTestData(opts: SeedOptions): Promise<void> {
  const token = await getAdminToken(opts);

  const res = await fetch(`${opts.apiUrl}/api/v1/test/seed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(SEED_BUNDLE),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Seed failed ${res.status}: ${body}`);
  }

  const result = (await res.json()) as { seeded: boolean; entityCounts: Record<string, number> };
  console.log("[seed] seeded entities:", result.entityCounts);
}

async function getAdminToken(opts: SeedOptions): Promise<string> {
  const res = await fetch(`${opts.apiUrl}/api/v1/auth/password-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: opts.adminEmail, password: opts.adminPassword }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Admin login failed: ${res.status}`);
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

/** Deterministic seed bundle — all IDs are fixed UUIDs for cross-test referencing */
export const SEED_BUNDLE = {
  firm: {
    id: "00000000-0001-0000-0000-000000000001",
    name: "Alpha Certification Body",
    schemePrefix: "ACB",
    accreditationBody: "TEST-ILAC",
  },
  auditors: [
    {
      id: "00000000-0002-0000-0000-000000000001",
      firmId: "00000000-0001-0000-0000-000000000001",
      email: "lead@auditforge.test",
      name: "Alice Lead",
      role: "lead_auditor",
      password: "LeadAuditor_Test_2024!",
      certifications: ["ISO42001-LA-2024", "ISO27001-LA-2022"],
    },
    {
      id: "00000000-0002-0000-0000-000000000002",
      firmId: "00000000-0001-0000-0000-000000000001",
      email: "team@auditforge.test",
      name: "Bob Team",
      role: "team_auditor",
      password: "TeamAuditor_Test_2024!",
      certifications: ["ISO42001-A-2024"],
    },
    {
      id: "00000000-0002-0000-0000-000000000003",
      firmId: "00000000-0001-0000-0000-000000000001",
      email: "reviewer@auditforge.test",
      name: "Carol Reviewer",
      role: "peer_reviewer",
      password: "PeerReview_Test_2024!",
      certifications: ["ISO42001-LA-2023"],
    },
    {
      id: "00000000-0002-0000-0000-000000000004",
      firmId: "00000000-0001-0000-0000-000000000001",
      email: "accred@auditforge.test",
      name: "Dave Accred",
      role: "accreditation_auditor",
      password: "AccredAuditor_Test_2024!",
    },
  ],
  client: {
    id: "00000000-0003-0000-0000-000000000001",
    firmId: "00000000-0001-0000-0000-000000000001",
    name: "ClientAlpha Corp",
    country: "GB",
    sector: "financial_services",
    aimsScope: "Development and deployment of AI-powered credit risk models and fraud detection systems",
    contactEmail: "auditee@client-alpha.test",
    contactPassword: "Auditee_Test_2024!",
  },
  engagement: {
    id: "00000000-0004-0000-0000-000000000001",
    firmId: "00000000-0001-0000-0000-000000000001",
    clientId: "00000000-0003-0000-0000-000000000001",
    leadAuditorId: "00000000-0002-0000-0000-000000000001",
    teamMemberIds: ["00000000-0002-0000-0000-000000000002"],
    certificationStandard: "ISO_42001_2023",
    cycleType: "initial_certification",
    status: "stage2_in_progress",
    plannedStage2Start: "2024-03-01",
  },
  aiSystems: [
    {
      id: "00000000-0005-0000-0000-000000000001",
      engagementId: "00000000-0004-0000-0000-000000000001",
      name: "CreditRisk-v3",
      type: "predictive_ml",
      purpose: "Credit risk scoring for personal loan applications",
      euAiActTier: "high_risk",
      deploymentStatus: "production",
    },
    {
      id: "00000000-0005-0000-0000-000000000002",
      engagementId: "00000000-0004-0000-0000-000000000001",
      name: "FraudDetect-Agent",
      type: "ai_agent",
      purpose: "Agentic fraud investigation assistant with tool access",
      euAiActTier: "high_risk",
      deploymentStatus: "production",
    },
  ],
};

/** Predictable IDs exported for use in test assertions */
export const FIXTURE_IDS = {
  firmId: SEED_BUNDLE.firm.id,
  engagementId: SEED_BUNDLE.engagement.id,
  leadAuditorId: SEED_BUNDLE.auditors[0]!.id,
  teamAuditorId: SEED_BUNDLE.auditors[1]!.id,
  reviewerId: SEED_BUNDLE.auditors[2]!.id,
  accredAuditorId: SEED_BUNDLE.auditors[3]!.id,
  clientId: SEED_BUNDLE.client.id,
  aiSystemModelId: SEED_BUNDLE.aiSystems[0]!.id,
  aiSystemAgentId: SEED_BUNDLE.aiSystems[1]!.id,
} as const;
