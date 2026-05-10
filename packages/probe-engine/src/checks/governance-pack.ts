// SPDX-License-Identifier: BUSL-1.1
import type { AnyProbeDefinition } from '../dsl.js';

import {
  defineConformanceProbe,
  type ConformanceAdapterOptions,
  type ConformanceEntry,
} from './conformance-shared.js';

export const GOVERNANCE_CONFORMANCE_PACK: readonly ConformanceEntry[] = [
  {
    probeId: 'P-AEGOV-01',
    sidecarCheckId: 'P-GOV-01',
    title: 'AIMS-Scope-Statement',
    description:
      'Verifies the AIMS scope endpoint returns a canonical version with leadership-approval timestamp.',
    annexA: ['A.2.2'],
    clauses: ['4.3', '5.1'],
    tags: ['governance', 'scope'],
  },
  {
    probeId: 'P-AEGOV-02',
    sidecarCheckId: 'P-GOV-02',
    title: 'Roles-And-Responsibilities',
    description:
      'Verifies documented roles each carry a named owner and reachable contact.',
    annexA: ['A.3.2'],
    clauses: ['5.3'],
    tags: ['governance', 'roles'],
  },
  {
    probeId: 'P-AEGOV-03',
    sidecarCheckId: 'P-GOV-03',
    title: 'Resource-Allocation-Approved',
    description:
      'Verifies the resource-allocation record matches the latest planning record.',
    annexA: ['A.4.2', 'A.4.5'],
    clauses: ['7.1'],
    tags: ['governance', 'resources'],
  },
  {
    probeId: 'P-AEGOV-04',
    sidecarCheckId: 'P-GOV-04',
    title: 'Communication-Records',
    description:
      'Verifies the communication endpoint exposes both internal and external comms entries.',
    annexA: ['A.8.3', 'A.8.5'],
    clauses: ['7.4'],
    tags: ['governance', 'communication'],
  },
  {
    probeId: 'P-AEGOV-05',
    sidecarCheckId: 'P-GOV-05',
    title: 'Document-Control',
    description:
      'Verifies controlled-document change records carry signer + signature.',
    annexA: ['A.6.2.7'],
    clauses: ['7.5', '7.5.3'],
    tags: ['governance', 'document-control'],
  },
  {
    probeId: 'P-AEGOV-06',
    sidecarCheckId: 'P-GOV-06',
    title: 'Continual-Improvement-Backlog',
    description:
      'Verifies improvement-backlog items carry status and owner fields.',
    annexA: ['A.2.4'],
    clauses: ['10.1', '10.2'],
    tags: ['governance', 'improvement'],
  },
];

export function buildGovernanceConformancePack(
  options: ConformanceAdapterOptions,
): readonly AnyProbeDefinition[] {
  return GOVERNANCE_CONFORMANCE_PACK.map((entry) =>
    defineConformanceProbe(entry, options, 'src/checks/governance-pack.ts'),
  );
}
