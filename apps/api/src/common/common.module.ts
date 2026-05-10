// SPDX-License-Identifier: BUSL-1.1
import { Global, Logger, Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../adapters/audit-engine.adapter.js';
import { TenancyAdapter } from '../adapters/tenancy.adapter.js';
import { AuditTrailInterceptor } from './audit-trail.interceptor.js';
import { LEDGER_SINK, type LedgerSink, type CallerContext } from './auth.guard.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import { RbacGuard } from './rbac.guard.js';
import { SignedActionInterceptor } from './signed-action.interceptor.js';

// Default LedgerSink: pipes auth-failure events into the audit-engine
// adapter. Identity, signed-action, and webauthn sinks all alias to this
// canonical provider via `useExisting: LEDGER_SINK` so a single ledger
// chain captures the events.
class DefaultLedgerSink implements LedgerSink {
  private readonly logger = new Logger(DefaultLedgerSink.name);
  constructor(private readonly audit: AuditEngineAdapter) {}
  async emitAuthFailure(
    reason: string,
    context: Partial<CallerContext> & { ip?: string },
  ): Promise<void> {
    try {
      await this.audit.append({
        firmId: context.firmId ?? 'unknown',
        actorId: context.auditorId ?? 'system',
        type: `auth.failure.${reason}`,
        entity: 'auth',
        entityId: context.jti ?? context.ip ?? 'unknown',
        payload: { reason, ip: context.ip ?? null },
      });
    } catch (e) {
      this.logger.warn({ msg: 'auth-failure emit dropped', reason, err: String(e) });
    }
  }
}

@Global()
@Module({
  providers: [
    AuditEngineAdapter,
    TenancyAdapter,
    RbacGuard,
    AuditTrailInterceptor,
    IdempotencyInterceptor,
    SignedActionInterceptor,
    {
      provide: LEDGER_SINK,
      inject: [AuditEngineAdapter],
      useFactory: (audit: AuditEngineAdapter): LedgerSink => new DefaultLedgerSink(audit),
    },
  ],
  exports: [
    AuditEngineAdapter,
    TenancyAdapter,
    RbacGuard,
    AuditTrailInterceptor,
    IdempotencyInterceptor,
    SignedActionInterceptor,
    LEDGER_SINK,
  ],
})
export class CommonModule {}
