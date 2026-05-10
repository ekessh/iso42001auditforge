// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors

import type { ZodSchema } from "zod";

export type Tier = "small" | "medium" | "large" | "reasoning";

export interface LlmMockInvocation {
  readonly callSite: string;
  readonly tier: Tier;
  readonly providerId: string;
  readonly modelName: string;
  readonly promptHash: string;
  readonly schemaTag: string | undefined;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly latencyMs: number;
}

export interface LlmMockOptions {
  readonly tierFor: (callSite: string) => Tier;
  readonly providerFor: (tier: Tier) => { providerId: string; modelName: string; isCloud: boolean };
  readonly responseFor: <T>(callSite: string, schema?: ZodSchema<T>) => T;
}

const hash32 = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
};

/**
 * LLM provider mock that records every invocation and asserts tier routing.
 * Use in unit tests to verify the tier router selected the expected tier for
 * a given call site, and that schema-constrained calls supplied a schema.
 */
export class LlmMock {
  private readonly invocations: LlmMockInvocation[] = [];

  constructor(private readonly opts: LlmMockOptions) {}

  async reasonStructured<T>(
    callSite: string,
    prompt: string,
    schema: ZodSchema<T>,
    schemaTag?: string,
  ): Promise<T> {
    const tier = this.opts.tierFor(callSite);
    const provider = this.opts.providerFor(tier);
    const result = this.opts.responseFor(callSite, schema);
    schema.parse(result);
    this.invocations.push({
      callSite,
      tier,
      providerId: provider.providerId,
      modelName: provider.modelName,
      promptHash: hash32(prompt),
      schemaTag,
      tokensIn: prompt.length / 4,
      tokensOut: JSON.stringify(result).length / 4,
      latencyMs: 1,
    });
    return result;
  }

  recorded(): ReadonlyArray<LlmMockInvocation> {
    return [...this.invocations];
  }

  /** Assert that every invocation for `callSite` used `expectedTier`. */
  assertTier(callSite: string, expectedTier: Tier): void {
    const off = this.invocations.filter(
      (i) => i.callSite === callSite && i.tier !== expectedTier,
    );
    if (off.length > 0) {
      throw new Error(
        `LlmMock: ${off.length} invocations of '${callSite}' used wrong tier; expected '${expectedTier}', got '${off[0]?.tier}'`,
      );
    }
  }

  reset(): void {
    this.invocations.length = 0;
  }
}
