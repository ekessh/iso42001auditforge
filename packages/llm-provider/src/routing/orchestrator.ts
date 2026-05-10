// SPDX-License-Identifier: BUSL-1.1
import type { ZodSchema } from 'zod';
import type {
  CompletionOpts,
  CompletionResult,
  LLMProvider,
  ReasoningResult,
} from '../types.js';
import type { TaskName, TierRouter } from './tier-router.js';
import type { LlmTier, InvocationLedger } from './invocation-ledger.js';
import type { ConsentGuard } from './consent.js';
import type { CostController } from './cost-controller.js';
import type { PromptTemplateRegistry } from '../templates/registry.js';
import { TemplateMismatch } from '../errors.js';

export interface OrchestratorConfig {
  router: TierRouter;
  ledger: InvocationLedger;
  consent: ConsentGuard;
  cost: CostController;
  templates: PromptTemplateRegistry;
}

export interface OrchestratorRouteOpts extends Omit<CompletionOpts, 'task'> {
  task: TaskName;
  estimatedUsd?: number;
}

export class LLMOrchestrator {
  constructor(private readonly cfg: OrchestratorConfig) {}

  private requireTemplate(version: string): void {
    if (!this.cfg.templates.has(version)) {
      throw new TemplateMismatch(version, null);
    }
  }

  private templateAttribution(version: string): {
    promptTemplateId?: string;
    promptTemplateHash?: string;
  } {
    if (!this.cfg.templates.has(version)) return {};
    const t = this.cfg.templates.get(version);
    const out: { promptTemplateId?: string; promptTemplateHash?: string } = {
      promptTemplateHash: t.hash,
    };
    if (t.id !== undefined) out.promptTemplateId = t.id;
    return out;
  }

  private async preflight(opts: OrchestratorRouteOpts): Promise<{
    provider: LLMProvider;
    tier: LlmTier;
    fellBack: boolean;
  }> {
    this.requireTemplate(opts.promptTemplateVersion);
    const routeOpts: { engagementId?: string; preferLocal?: boolean } = {};
    if (opts.engagementId !== undefined) routeOpts.engagementId = opts.engagementId;
    const { provider, tier } = this.cfg.router.route(opts.task, routeOpts);
    if (!opts.engagementId || !opts.firmId) {
      return { provider, tier, fellBack: false };
    }
    await this.cfg.consent.assertCloudAllowed({
      providerName: provider.metadata().provider,
      isCloud: provider.isCloud(),
      engagementId: opts.engagementId,
      ...(opts.consentRecordId !== undefined ? { consentRecordId: opts.consentRecordId } : {}),
    });
    const decision = await this.cfg.cost.preflight(
      opts.engagementId,
      opts.estimatedUsd ?? 0,
      provider.isCloud(),
    );
    if (decision.mode === 'fallback_local') {
      const fallback = this.cfg.router.fallbackLocal(tier);
      if (!fallback) {
        throw new Error(`cost cap reached and no local fallback for tier ${tier}`);
      }
      return { provider: fallback, tier, fellBack: true };
    }
    return { provider, tier, fellBack: false };
  }

  async complete(prompt: string, opts: OrchestratorRouteOpts): Promise<CompletionResult> {
    const { provider, tier } = await this.preflight(opts);
    const result = await provider.complete(prompt, opts);
    await this.recordInvocation(opts, tier, provider, result);
    return result;
  }

  async classifyStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: OrchestratorRouteOpts,
  ): Promise<T> {
    const { provider, tier } = await this.preflight(opts);
    const start = Date.now();
    const value = await provider.classifyStructured(prompt, schema, opts);
    const latency = Date.now() - start;
    if (opts.engagementId && opts.firmId) {
      await this.cfg.ledger.record({
        firmId: opts.firmId,
        engagementId: opts.engagementId,
        task: opts.task,
        tier,
        provider: provider.metadata().provider,
        modelName: provider.metadata().modelName,
        ...(provider.metadata().modelHash !== undefined ? { modelHash: provider.metadata().modelHash } : {}),
        ...(provider.metadata().modelVersion !== undefined ? { modelVersion: provider.metadata().modelVersion } : {}),
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        promptTemplateVersion: opts.promptTemplateVersion,
        ...this.templateAttribution(opts.promptTemplateVersion),
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: latency,
        metadata: { mode: 'classifyStructured' },
      });
    }
    return value;
  }

  async reasonStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: OrchestratorRouteOpts & { effortLevel?: 'low' | 'medium' | 'high' },
  ): Promise<ReasoningResult<T>> {
    const { provider, tier } = await this.preflight(opts);
    const result = await provider.reasonStructured(prompt, schema, opts);
    if (opts.engagementId && opts.firmId) {
      await this.cfg.ledger.record({
        firmId: opts.firmId,
        engagementId: opts.engagementId,
        task: opts.task,
        tier,
        provider: provider.metadata().provider,
        modelName: provider.metadata().modelName,
        ...(provider.metadata().modelHash !== undefined ? { modelHash: provider.metadata().modelHash } : {}),
        ...(provider.metadata().modelVersion !== undefined ? { modelVersion: provider.metadata().modelVersion } : {}),
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        promptTemplateVersion: opts.promptTemplateVersion,
        ...this.templateAttribution(opts.promptTemplateVersion),
        inputTokens: result.raw.tokensUsed.input,
        outputTokens: result.raw.tokensUsed.output,
        latencyMs: result.raw.latencyMs,
        ...(result.raw.costUsd !== undefined ? { costUsd: result.raw.costUsd } : {}),
        reasoningTrace: result.reasoningTrace,
        metadata: { mode: 'reasonStructured' },
      });
      if (result.raw.costUsd !== undefined) {
        await this.cfg.cost.record(opts.engagementId, result.raw.costUsd);
      }
    }
    return result;
  }

  private async recordInvocation(
    opts: OrchestratorRouteOpts,
    tier: LlmTier,
    provider: LLMProvider,
    result: CompletionResult,
  ): Promise<void> {
    if (!opts.engagementId || !opts.firmId) return;
    await this.cfg.ledger.record({
      firmId: opts.firmId,
      engagementId: opts.engagementId,
      task: opts.task,
      tier,
      provider: provider.metadata().provider,
      modelName: provider.metadata().modelName,
      ...(provider.metadata().modelHash !== undefined ? { modelHash: provider.metadata().modelHash } : {}),
      ...(provider.metadata().modelVersion !== undefined ? { modelVersion: provider.metadata().modelVersion } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      promptTemplateVersion: opts.promptTemplateVersion,
      inputTokens: result.tokensUsed.input,
      outputTokens: result.tokensUsed.output,
      latencyMs: result.latencyMs,
      ...(result.costUsd !== undefined ? { costUsd: result.costUsd } : {}),
      metadata: { mode: 'complete' },
    });
    if (result.costUsd !== undefined) {
      await this.cfg.cost.record(opts.engagementId, result.costUsd);
    }
  }
}
