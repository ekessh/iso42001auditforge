// SPDX-License-Identifier: BUSL-1.1
import type { AnyProbeDefinition } from '../dsl.js';

import {
  defineConformanceProbe,
  type ConformanceAdapterOptions,
  type ConformanceEntry,
} from './conformance-shared.js';

export const RISK_CONFORMANCE_PACK: readonly ConformanceEntry[] = [
  {
    probeId: 'P-AERISK-01',
    sidecarCheckId: 'P-RISK-01',
    title: 'Risk-Register-Reviewed',
    description:
      'Verifies every entry in the risk register has been reviewed within the documented review period.',
    annexA: ['A.5.2'],
    clauses: ['6.1.2', '9.3'],
    tags: ['risk', 'governance'],
  },
  {
    probeId: 'P-AERISK-02',
    sidecarCheckId: 'P-RISK-02',
    title: 'High-Risk-Treatment-Plan-Closed',
    description:
      'Verifies every high-risk item has a closed treatment plan with an effectiveness check.',
    annexA: ['A.5.4'],
    clauses: ['6.1.3', '8.3'],
    tags: ['risk', 'treatment'],
  },
  {
    probeId: 'P-AERISK-03',
    sidecarCheckId: 'P-RISK-03',
    title: 'Mitigation-Effectiveness-Test',
    description:
      'Verifies each high-risk mitigation has been retested within the documented retest cycle.',
    annexA: ['A.5.4'],
    clauses: ['6.1.3', '9.1'],
    tags: ['risk', 'effectiveness'],
  },
  {
    probeId: 'P-AERISK-04',
    sidecarCheckId: 'P-RISK-04',
    title: 'Residual-Risk-Acknowledged',
    description:
      'Verifies every residual risk has an explicit acknowledgement signed by an accountable owner.',
    annexA: ['A.3.2'],
    clauses: ['5.1', '6.1.3'],
    tags: ['risk', 'governance'],
  },
  {
    probeId: 'P-AERISK-05',
    sidecarCheckId: 'P-RISK-05',
    title: 'Change-Triggered-Re-Assessment',
    description:
      'Verifies a documented significant change triggered a documented re-assessment within SLA.',
    annexA: ['A.5.2'],
    clauses: ['6.3', '8.2'],
    tags: ['risk', 'change-control'],
  },
  {
    probeId: 'P-AERISK-06',
    sidecarCheckId: 'P-RISK-06',
    title: 'Risk-Appetite-Defined',
    description:
      'Verifies the risk-appetite endpoint returns a current statement matching the latest management review id.',
    annexA: ['A.2.2'],
    clauses: ['5.2', '6.1.2', '9.3'],
    tags: ['risk', 'governance'],
  },
];

export function buildRiskConformancePack(
  options: ConformanceAdapterOptions,
): readonly AnyProbeDefinition[] {
  return RISK_CONFORMANCE_PACK.map((entry) =>
    defineConformanceProbe(entry, options, 'src/checks/risk-pack.ts'),
  );
}
