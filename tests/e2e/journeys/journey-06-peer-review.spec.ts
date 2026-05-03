// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/**
 * Journey 6 — Peer Reviewer Assigned → File Review → Request Changes → Approve
 *
 * Validates the peer review workflow:
 * 1. Audit manager assigns peer reviewer
 * 2. Peer reviewer gets notification
 * 3. Peer reviewer reviews working papers and findings
 * 4. Peer reviewer requests changes
 * 5. Lead auditor addresses changes
 * 6. Peer reviewer approves
 *
 * @tags @critical @journey @nightly
 */
import { test, expect } from "@playwright/test";
import { PeerReviewPage, FindingsPage, assertPageLCP } from "../helpers/page-objects";

const LEAD_AUTH_STATE = "test-results/auth-lead_auditor.json";
const REVIEWER_AUTH_STATE = "test-results/auth-peer_reviewer.json";
const ENGAGEMENT_ID = "00000000-0004-0000-0000-000000000001";

test.describe("Journey 6 - Peer Review Workflow", () => {
  test("J6a: lead auditor initiates peer review", async ({ browser }) => {
    const leadCtx = await browser.newContext({ storageState: LEAD_AUTH_STATE });
    const leadPage = await leadCtx.newPage();

    await leadPage.goto(`/engagements/${ENGAGEMENT_ID}/peer-review`);
    await leadPage.waitForLoadState("networkidle");
    await assertPageLCP(leadPage);

    // Initiate peer review
    await leadPage.getByRole("button", { name: /request.*peer.*review|assign.*reviewer/i }).click();

    // Select reviewer
    await leadPage.getByRole("combobox", { name: /reviewer/i }).click();
    await leadPage.getByRole("option", { name: /Carol Reviewer/i }).click();

    // Set deadline
    await leadPage.getByLabel(/deadline|due.*date/i).fill("2024-04-30");
    await leadPage.getByRole("button", { name: /assign|send.*request/i }).click();

    await expect(leadPage.getByText(/review.*requested|reviewer.*assigned/i)).toBeVisible();
    await leadPage.screenshot({ path: "test-results/j6-01-review-initiated.png" });

    await leadCtx.close();
  });

  test("J6b: peer reviewer reviews file and requests changes", async ({ browser }) => {
    const reviewerCtx = await browser.newContext({ storageState: REVIEWER_AUTH_STATE });
    const reviewerPage = await reviewerCtx.newPage();

    // Check notification
    await reviewerPage.goto("/notifications");
    await expect(reviewerPage.getByText(/peer review.*requested|review.*assigned/i)).toBeVisible();
    await reviewerPage.screenshot({ path: "test-results/j6-02-reviewer-notification.png" });

    // Navigate to review
    const peerReview = new PeerReviewPage(reviewerPage);
    await peerReview.goto(ENGAGEMENT_ID);
    await assertPageLCP(reviewerPage);

    // Review checklist
    await expect(reviewerPage.getByTestId("review-checklist")).toBeVisible();
    await reviewerPage.screenshot({ path: "test-results/j6-03-review-checklist.png" });

    // Complete checklist items
    const checklistItems = reviewerPage.getByTestId("checklist-item");
    const itemCount = await checklistItems.count();
    for (let i = 0; i < itemCount; i++) {
      await checklistItems.nth(i).getByRole("checkbox").check();
    }

    // Review working papers
    await reviewerPage.getByRole("tab", { name: /working papers/i }).click();
    await expect(reviewerPage.getByTestId("wp-review-list")).toBeVisible();

    // Check first WP
    await reviewerPage.getByTestId("wp-review-list").locator("tr").nth(1).getByRole("button", { name: /review/i }).click();
    await reviewerPage.waitForLoadState("networkidle");
    await reviewerPage.screenshot({ path: "test-results/j6-04-wp-review.png" });

    // Verify read-only mode for reviewer
    const editor = reviewerPage.locator('[contenteditable="true"]');
    if (await editor.isVisible()) {
      await expect(editor).toHaveAttribute("contenteditable", "false");
    }

    // Go back to review
    await reviewerPage.getByRole("button", { name: /back.*review|return/i }).click();

    // Add review comment
    await reviewerPage.getByRole("tab", { name: /comments|notes/i }).click();
    await reviewerPage.getByRole("button", { name: /add.*comment/i }).click();
    await reviewerPage.getByLabel(/comment/i).fill(
      "Working paper for clause 8.4 does not clearly state the sampling methodology used. " +
        "Please add the sample size and selection rationale.",
    );
    await reviewerPage.getByTestId("comment-wp-ref").fill("WP-8.4");
    await reviewerPage.getByRole("button", { name: /save|add/i }).click();

    // Request changes
    await peerReview.requestChanges(
      "Please address the following before approval:\n" +
        "1. WP for clause 8.4 — add sampling methodology and sample size rationale\n" +
        "2. NC-001 statement needs to explicitly reference the specific requirement not met\n" +
        "Overall quality is good but these items need attention.",
    );
    await reviewerPage.screenshot({ path: "test-results/j6-05-changes-requested.png" });

    await reviewerCtx.close();
  });

  test("J6c: lead auditor addresses review comments and re-submits", async ({ browser }) => {
    const leadCtx = await browser.newContext({ storageState: LEAD_AUTH_STATE });
    const leadPage = await leadCtx.newPage();

    await leadPage.goto(`/engagements/${ENGAGEMENT_ID}/peer-review`);
    await leadPage.waitForLoadState("networkidle");

    // Should see changes requested status
    await expect(leadPage.getByText(/changes.*requested|revisions.*needed/i)).toBeVisible();
    await leadPage.screenshot({ path: "test-results/j6-06-lead-sees-changes.png" });

    // Address the comments
    await leadPage.getByRole("button", { name: /address.*comments|respond/i }).click();
    await leadPage.getByLabel(/response|addressed/i).fill(
      "Addressed:\n1. Added sampling methodology to WP 8.4: Random sample of 15 from population of 82 records\n" +
        "2. Updated NC-001 statement to explicitly cite requirement clause 8.4.2 para (b)",
    );
    await leadPage.getByRole("button", { name: /save|submit.*response/i }).click();

    // Re-submit for review
    await leadPage.getByRole("button", { name: /re.submit|submit.*review/i }).click();
    await expect(leadPage.getByText(/re.submitted|under.*review/i)).toBeVisible();
    await leadPage.screenshot({ path: "test-results/j6-07-resubmitted.png" });

    await leadCtx.close();
  });

  test("J6d: peer reviewer approves the file", async ({ browser }) => {
    const reviewerCtx = await browser.newContext({ storageState: REVIEWER_AUTH_STATE });
    const reviewerPage = await reviewerCtx.newPage();

    const peerReview = new PeerReviewPage(reviewerPage);
    await peerReview.goto(ENGAGEMENT_ID);
    await assertPageLCP(reviewerPage);

    // Verify responses are visible
    await reviewerPage.getByRole("tab", { name: /responses|comments/i }).click();
    await expect(reviewerPage.getByText(/addressed|sampling methodology/i)).toBeVisible();
    await reviewerPage.screenshot({ path: "test-results/j6-08-review-responses.png" });

    // Approve
    await peerReview.approveReview();
    await reviewerPage.screenshot({ path: "test-results/j6-09-approved.png" });

    // Verify approval is recorded
    await expect(reviewerPage.getByTestId("peer-review-approved-badge")).toBeVisible();
    await expect(reviewerPage.getByText(/Carol Reviewer.*approved|approved.*Carol/i)).toBeVisible();

    await reviewerCtx.close();
  });
});
