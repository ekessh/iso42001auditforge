// SPDX-License-Identifier: BUSL-1.1
import { Global, Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../adapters/audit-engine.adapter.js';
import { TenancyAdapter } from '../adapters/tenancy.adapter.js';
import { AuditTrailInterceptor } from './audit-trail.interceptor.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import { RbacGuard } from './rbac.guard.js';
import { SignedActionInterceptor } from './signed-action.interceptor.js';

@Global()
@Module({
  providers: [
    AuditEngineAdapter,
    TenancyAdapter,
    RbacGuard,
    AuditTrailInterceptor,
    IdempotencyInterceptor,
    SignedActionInterceptor,
  ],
  exports: [
    AuditEngineAdapter,
    TenancyAdapter,
    RbacGuard,
    AuditTrailInterceptor,
    IdempotencyInterceptor,
    SignedActionInterceptor,
  ],
})
export class CommonModule {}
