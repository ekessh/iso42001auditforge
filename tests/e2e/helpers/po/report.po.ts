// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
import { type Page, type Download, expect } from "@playwright/test";

export class ReportPo {
  constructor(private readonly page: Page) {}

  async openDraft(engagementId: string): Promise<void> {
    await this.page.goto(`/engagements/${engagementId}/report`);
    await this.page.waitForLoadState("networkidle");
  }

  async runQaChecklist(): Promise<void> {
    await this.page.getByRole("button", { name: /run qa checklist/i }).click();
    await expect(this.page.getByText(/all checks passed/i)).toBeVisible();
  }

  async publish(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent("download");
    await this.page.getByRole("button", { name: /^publish$/i }).click();
    await this.page.getByRole("button", { name: /yes,? publish/i }).click();
    return downloadPromise;
  }

  async expectIncludesSignatureAndTsa(download: Download): Promise<void> {
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const buf = Buffer.concat(chunks);
    expect(buf.length).toBeGreaterThan(1024);
    // PDF/A-3 magic and embedded TSA marker
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    const text = buf.toString("latin1");
    expect(text).toContain("/Subtype /Sig");
    expect(text).toMatch(/\/Type ?\/DocTimeStamp|TimeStampToken/);
  }
}
