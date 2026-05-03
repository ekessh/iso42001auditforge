// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/**
 * Global Playwright setup — runs once before all test projects.
 * Seeds predictable fixture data into the dev-stack database via the API.
 */
import { chromium, type FullConfig } from "@playwright/test";
import { seedTestData } from "./seed-api";

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  // Wait for the dev stack to be healthy
  await waitForStack(baseURL);

  // Seed predictable fixture data (idempotent — uses upsert)
  await seedTestData({
    apiUrl: process.env["E2E_API_URL"] ?? "http://localhost:3001",
    adminEmail: "admin@auditforge.test",
    adminPassword: process.env["TEST_ADMIN_PASSWORD"] ?? "AuditForge_Test_2024!",
  });

  // Store auth state for each persona
  const browser = await chromium.launch();
  await saveAuthState(browser, baseURL, "lead_auditor");
  await saveAuthState(browser, baseURL, "team_auditor");
  await saveAuthState(browser, baseURL, "peer_reviewer");
  await saveAuthState(browser, baseURL, "accreditation_auditor");
  await saveAuthState(browser, baseURL, "auditee_user");
  await browser.close();
}

async function waitForStack(baseURL: string, maxRetries = 30): Promise<void> {
  const healthUrl = baseURL.replace(":3000", ":3001") + "/health";
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Stack not healthy after ${maxRetries * 2}s — check Docker Compose`);
}

async function saveAuthState(
  browser: import("@playwright/test").Browser,
  baseURL: string,
  role: string,
): Promise<void> {
  const page = await browser.newPage();
  const creds = ROLE_CREDENTIALS[role as keyof typeof ROLE_CREDENTIALS];
  if (!creds) return;

  await page.goto(`${baseURL}/auth/signin`);
  await page.fill('[name="email"]', creds.email);
  await page.fill('[name="password"]', creds.password);
  await page.click('[type="submit"]');
  await page.waitForURL(/\/dashboard|\/home/, { timeout: 15_000 });
  await page.context().storageState({ path: `test-results/auth-${role}.json` });
  await page.close();
}

const ROLE_CREDENTIALS = {
  lead_auditor: {
    email: "lead@auditforge.test",
    password: "LeadAuditor_Test_2024!",
  },
  team_auditor: {
    email: "team@auditforge.test",
    password: "TeamAuditor_Test_2024!",
  },
  peer_reviewer: {
    email: "reviewer@auditforge.test",
    password: "PeerReview_Test_2024!",
  },
  accreditation_auditor: {
    email: "accred@auditforge.test",
    password: "AccredAuditor_Test_2024!",
  },
  auditee_user: {
    email: "auditee@client-alpha.test",
    password: "Auditee_Test_2024!",
  },
} as const;
