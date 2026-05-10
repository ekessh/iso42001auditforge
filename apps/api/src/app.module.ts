// SPDX-License-Identifier: BUSL-1.1
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppConfigModule, APP_CONFIG } from './config/config.module.js';
import { CommonModule } from './common/common.module.js';
import { DbModule } from './db/db.module.js';
import { QueueModule } from './queue/queue.module.js';
import { StorageModule } from './storage/storage.module.js';

import { AuthGuard } from './common/auth.guard.js';
import { RbacGuard } from './common/rbac.guard.js';
import { AuditTrailInterceptor } from './common/audit-trail.interceptor.js';
import { IdempotencyInterceptor } from './common/idempotency.interceptor.js';
import { SignedActionInterceptor } from './common/signed-action.interceptor.js';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';
import { TenantThrottlerGuard } from './common/throttler.config.js';
import { RlsContextMiddleware } from './common/rls.middleware.js';
import { DevAuthMiddleware } from './common/dev-auth.middleware.js';

import { AdminModule } from './modules/admin/admin.module.js';
import { AgentWorkflowsModule } from './modules/agent-workflows/agent-workflows.module.js';
import { AiSystemsModule } from './modules/ai-systems/ai-systems.module.js';
import { ArchiveModule } from './modules/archive/archive.module.js';
import { AuditDashboardModule } from './modules/audit-dashboard/audit-dashboard.module.js';
import { AuditLedgerModule } from './modules/audit-ledger/audit-ledger.module.js';
import { AuditPlansModule } from './modules/audit-plans/audit-plans.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CandidateFindingsModule } from './modules/candidate-findings/candidate-findings.module.js';
import { CapaModule } from './modules/capa/capa.module.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { CoAuditorModule } from './modules/co-auditor/co-auditor.module.js';
import { CoverageModule } from './modules/coverage/coverage.module.js';
import { CrossFrameworkModule } from './modules/cross-framework/cross-framework.module.js';
import { EngagementsModule } from './modules/engagements/engagements.module.js';
import { EvidenceVaultModule } from './modules/evidence-vault/evidence-vault.module.js';
import { FindingsModule } from './modules/findings/findings.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { InterviewsModule } from './modules/interviews/interviews.module.js';
import { LibraryModule } from './modules/library/library.module.js';
import { ReadinessModule } from './modules/readiness/readiness.module.js';
import { PeerReviewModule } from './modules/peer-review/peer-review.module.js';
import { ProbesModule } from './modules/probes/probes.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { RisksModule } from './modules/risks/risks.module.js';
import { SamplesModule } from './modules/samples/samples.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { SoaModule } from './modules/soa/soa.module.js';
import { SurveillanceModule } from './modules/surveillance/surveillance.module.js';
import { TenancyModule } from './modules/tenancy/tenancy.module.js';
import { TracesModule } from './modules/traces/traces.module.js';
import { WorkingPapersModule } from './modules/working-papers/working-papers.module.js';
import { WorkingPapersSyncModule } from './modules/working-papers-sync/working-papers-sync.module.js';

import type { AppConfig } from './config/config.schema.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        autoLogging: true,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-webauthn-attestation"]'],
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => [{ ttl: cfg.RATE_LIMIT_TTL_MS, limit: cfg.RATE_LIMIT_MAX }],
    }),
    CommonModule,
    DbModule,
    QueueModule,
    StorageModule,

    AdminModule,
    AgentWorkflowsModule,
    AiSystemsModule,
    ArchiveModule,
    AuditLedgerModule,
    AuditPlansModule,
    BillingModule,
    CapaModule,
    ClientsModule,
    CoAuditorModule,
    CrossFrameworkModule,
    EngagementsModule,
    EvidenceVaultModule,
    FindingsModule,
    HealthModule,
    IdentityModule,
    InterviewsModule,
    PeerReviewModule,
    ProbesModule,
    ReportsModule,
    RisksModule,
    SamplesModule,
    SearchModule,
    SoaModule,
    SurveillanceModule,
    TenancyModule,
    TracesModule,
    WorkingPapersModule,
    WorkingPapersSyncModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_GUARD, useClass: TenantThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SignedActionInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditTrailInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const devAuthDisabled = process.env.AUDITFORGE_DISABLE_DEV_AUTH === '1';

    if (!isProduction && !devAuthDisabled) {
      // DevAuthMiddleware is only registered in non-production builds.
      // Any attempt to instantiate it in production will throw at construction
      // (see dev-auth.middleware.ts), so we never reach apply() there.
      consumer.apply(DevAuthMiddleware, RlsContextMiddleware).forRoutes('*');
    } else {
      consumer.apply(RlsContextMiddleware).forRoutes('*');
    }
  }
}
