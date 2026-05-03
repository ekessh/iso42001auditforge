// SPDX-License-Identifier: BUSL-1.1
import type { AuditPlan, PlanExportAdapter } from '../types/plan.js';

/**
 * No-op export adapter. Real DOCX/PDF rendering lives in
 * `packages/report-engine` (TODO). This stub is here so consumers can
 * wire the dependency in tests and the production wire-up can swap in
 * the real implementation.
 *
 * TODO(@auditforge/report-engine): replace with the real renderer.
 */
export class NoopPlanExportAdapter implements PlanExportAdapter {
  async renderDocx(plan: AuditPlan): Promise<Uint8Array> {
    return new TextEncoder().encode(
      JSON.stringify({ format: 'docx-stub', plan }, null, 2),
    );
  }
  async renderPdf(plan: AuditPlan): Promise<Uint8Array> {
    return new TextEncoder().encode(
      JSON.stringify({ format: 'pdf-stub', plan }, null, 2),
    );
  }
}
