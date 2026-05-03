// SPDX-License-Identifier: BUSL-1.1
//
// Interviews adapter — wires `@auditforge/interviews` into the API.
//
// Provides:
//   - Question library types (Iso42001Clause, AnnexAControlFamily,
//     AiSystemType, StakeholderRole, QuestionAxis).
//   - Tenant-scoped registry over the API DTO surface.
//
// TODO(integration): once `@auditforge/interviews/library` and
// `@auditforge/interviews/services` are stable, the adapter will expose
// the full question-library + scheduling + action-item state machine.
// The package's index.ts currently only re-exports `domain/question` —
// this adapter mirrors that surface.

import { Inject, Injectable } from '@nestjs/common';
import * as interviewsPkg from '@auditforge/interviews';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type {
  InterviewsDto,
  CreateInterviewsDto,
  UpdateInterviewsDto,
} from '../modules/interviews/dto.js';

@Injectable()
export class InterviewsAdapter {
  /** Re-exported package surface (currently question-library types). */
  readonly pkg = interviewsPkg;

  /** Tenant-scoped registry over the API DTO. */
  readonly registry: TenantScopedRegistry<InterviewsDto, CreateInterviewsDto, UpdateInterviewsDto>;

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    this.registry = new TenantScopedRegistry<InterviewsDto, CreateInterviewsDto, UpdateInterviewsDto>(
      { entity: 'interview', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as InterviewsDto,
      'Interviews',
    );
  }
}
