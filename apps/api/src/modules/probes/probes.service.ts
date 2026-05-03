// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/config.schema.js';
import { ConflictError } from '../../common/errors.js';
import { queueToken } from '../../queue/queue.module.js';
import type { CreateProbeDefinitionDto, ExecuteProbeDto, ProbeDefinitionDto, ProbeExecutionDto } from './dto.js';
import { ProbesRepository } from './probes.repository.js';

@Injectable()
export class ProbesService {
  constructor(
    private readonly repo: ProbesRepository,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(queueToken('probe-execution')) private readonly queue: Queue,
  ) {}

  createDefinition(firmId: string, dto: CreateProbeDefinitionDto) { return this.repo.createDefinition(firmId, dto); }
  getDefinition(firmId: string, id: string) { return this.repo.findDefinition(firmId, id); }
  listDefinitions(firmId: string, opts: { cursor?: string; limit: number }) { return this.repo.listDefinitions(firmId, opts); }

  async execute(firmId: string, probeId: string, dto: ExecuteProbeDto): Promise<ProbeExecutionDto> {
    const probe = await this.repo.findDefinition(firmId, probeId);
    if (probe.budgetUsd > 0) {
      const spent = await this.repo.sumCostByEngagement(firmId, dto.engagementId);
      if (spent + probe.budgetUsd > this.cfg.PROBE_BUDGET_DEFAULT_USD) {
        throw new ConflictError('Probe budget exceeded', { spent, allowance: this.cfg.PROBE_BUDGET_DEFAULT_USD });
      }
    }
    const job = await this.queue.add('execute', {
      firmId, probeId, engagementId: dto.engagementId,
      mode: probe.mode, spec: probe.spec, parameters: dto.parameters,
      ...(dto.aiSystemId ? { aiSystemId: dto.aiSystemId } : {}),
      ...(dto.testSetId ? { testSetId: dto.testSetId } : {}),
      caps: { cpuMs: probe.cpuMs, memMb: probe.memMb, allowedHosts: this.cfg.AGENT_ALLOWED_HOSTS.split(',').filter(Boolean) },
    });
    return this.repo.createExecution(firmId, probeId, dto, String(job.id));
  }

  getExecution(firmId: string, id: string) { return this.repo.findExecution(firmId, id); }
  listExecutions(firmId: string, opts: { engagementId?: string; cursor?: string; limit: number }) { return this.repo.listExecutions(firmId, opts); }

  async budgetSummary(firmId: string, engagementId: string): Promise<{ spent: number; allowance: number; remaining: number }> {
    const spent = await this.repo.sumCostByEngagement(firmId, engagementId);
    const allowance = this.cfg.PROBE_BUDGET_DEFAULT_USD;
    return { spent, allowance, remaining: Math.max(0, allowance - spent) };
  }
}
