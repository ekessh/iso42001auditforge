// SPDX-License-Identifier: BUSL-1.1
/**
 * Surveillance timeline read endpoint.
 *
 *   GET /v1/surveillance/clients/:id/timeline
 *
 * Returns the per-client surveillance schedule, last audit summary, open NC carryover, anomaly
 * flags, and upcoming re-audit triggers. Pure projection over the in-memory plan store; persists
 * via the surveillance_plans table once the production repository lands.
 *
 * WHY in apps/api/src/observability: this endpoint is part of the Phase 11 telemetry surface; it
 * lives next to the deps-health and RUM ingest endpoints so that all observability HTTP routes
 * are together and easy to audit.
 */
import { Controller, Get, NotFoundException, Param, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import {
  detectAnomalies,
  generateDefaultPlan,
  projectTimeline,
  type SurveillancePlan,
  type SurveillanceTimeline,
} from '@auditforge/surveillance';

import { Rbac } from '../common/rbac.guard.js';
import { requireAuth } from '../common/rls.middleware.js';

let counter = 0;
const newId = (): string => `srv-${++counter}`;
const newFlagId = (): string => `flag-${++counter}`;

const memoryPlans = new Map<string, SurveillancePlan>();

function planKey(firmId: string, clientId: string): string {
  return `${firmId}:${clientId}`;
}

@ApiTags('surveillance')
@Controller({ path: 'surveillance/clients', version: '1' })
export class SurveillanceTimelineController {
  @Get(':id/timeline')
  @Rbac('surveillance', 'read')
  @ApiOkResponse({ description: 'Surveillance timeline for a certified client' })
  async timeline(
    @Req() req: FastifyRequest,
    @Param('id') clientId: string,
  ): Promise<SurveillanceTimeline> {
    const auth = requireAuth(req);
    const key = planKey(auth.firmId, clientId);
    let plan = memoryPlans.get(key);
    if (plan === undefined) {
      if (!process.env['AUDITFORGE_SURVEILLANCE_AUTOSEED']) {
        throw new NotFoundException('surveillance plan not found');
      }
      plan = generateDefaultPlan({
        planId: newId(),
        clientId,
        tenantId: auth.firmId,
        certificationStartedAt: new Date(),
        newVisitId: newId,
      });
      memoryPlans.set(key, plan);
    }
    const flags = detectAnomalies({
      plan,
      ctx: {},
      now: new Date(),
      newFlagId,
    });
    return projectTimeline({ plan, flags });
  }
}
