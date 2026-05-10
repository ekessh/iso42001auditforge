// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
import { type Page, expect } from "@playwright/test";

export class AuthPo {
  constructor(private readonly page: Page) {}

  async gotoSignIn(): Promise<void> {
    await this.page.goto("/auth/signin");
  }

  async signInWithPasskeyStub(email = "lead@auditforge.test"): Promise<void> {
    // Driven by NEXT_PUBLIC_AUTH_STUB=1 — exposes a deterministic passkey
    // simulator on window so e2e doesn't depend on a real WebAuthn provider.
    await this.page.evaluate((emailArg: string) => {
      const w = window as unknown as { __authStub?: { signIn: (e: string) => Promise<void> } };
      if (!w.__authStub) {
        throw new Error("AUTH_STUB not loaded; set NEXT_PUBLIC_AUTH_STUB=1");
      }
      return w.__authStub.signIn(emailArg);
    }, email);
  }

  async expectOnDashboard(): Promise<void> {
    await this.page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await expect(this.page).toHaveURL(/\/dashboard/);
  }

  async expectErrorBanner(): Promise<void> {
    await expect(this.page.getByRole("alert")).toBeVisible();
  }
}
