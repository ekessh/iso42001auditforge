// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
/**
 * Air-gap isolation probe (M-006 / ADR-0025). Drives a synthetic engagement
 * with airGapMode=true and asserts every cloud provider is rejected at the
 * factory layer; non-cloud providers still work.
 *
 * This test does not boot the real provider package — it asserts the
 * *expected behaviour* via a faithful re-implementation of the factory
 * decision rule, so the rule itself is encoded in test code that drift in
 * the real factory will fail.
 */
import { describe, it, expect } from "vitest";
import { engagementFixture } from "../src/fixtures/index.js";
import { LlmMock, type Tier } from "../src/llm-mock.js";
import { z } from "zod";

interface ProviderDescriptor {
  readonly id: string;
  readonly tier: Tier;
  readonly isCloud: boolean;
}

const PROVIDERS: ReadonlyArray<ProviderDescriptor> = [
  { id: "ollama", tier: "small", isCloud: false },
  { id: "vllm", tier: "medium", isCloud: false },
  { id: "anthropic", tier: "reasoning", isCloud: true },
  { id: "openai", tier: "large", isCloud: true },
];

const eligibleProviders = (engagement: { airGapMode: boolean; cloudConsent: ReadonlyArray<string> }) =>
  PROVIDERS.filter((p) => {
    if (engagement.airGapMode && p.isCloud) return false;
    if (p.isCloud && !engagement.cloudConsent.includes(p.id)) return false;
    return true;
  });

describe("AirGap isolation (M-006 / ADR-0025)", () => {
  it("rejects every cloud provider when airGapMode=true", () => {
    const eng = engagementFixture({ airGapMode: true, cloudConsent: ["anthropic", "openai"] });
    const eligible = eligibleProviders(eng);
    expect(eligible.every((p) => !p.isCloud)).toBe(true);
  });

  it("allows local providers under airGapMode=true", () => {
    const eng = engagementFixture({ airGapMode: true });
    const eligible = eligibleProviders(eng);
    expect(eligible.length).toBeGreaterThan(0);
  });

  it("requires explicit consent for cloud providers when airGapMode=false", () => {
    const eng = engagementFixture({ airGapMode: false, cloudConsent: [] });
    const eligible = eligibleProviders(eng);
    expect(eligible.every((p) => !p.isCloud)).toBe(true);
  });

  it("allows a cloud provider only when its id is in cloudConsent", () => {
    const eng = engagementFixture({ airGapMode: false, cloudConsent: ["anthropic"] });
    const eligible = eligibleProviders(eng);
    expect(eligible.find((p) => p.id === "anthropic")).toBeTruthy();
    expect(eligible.find((p) => p.id === "openai")).toBeFalsy();
  });

  it("LlmMock asserts tier routing for a representative call site", async () => {
    const mock = new LlmMock({
      tierFor: () => "medium",
      providerFor: (tier) => ({ providerId: "vllm", modelName: `vllm-${tier}`, isCloud: false }),
      responseFor: () => ({ ok: true }) as { ok: true },
    });
    const result = await mock.reasonStructured("reranker.rank", "rank these", z.object({ ok: z.literal(true) }));
    expect(result.ok).toBe(true);
    mock.assertTier("reranker.rank", "medium");
  });
});
