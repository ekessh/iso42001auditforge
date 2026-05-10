// SPDX-License-Identifier: BUSL-1.1
import type { AnyProbeDefinition } from '../dsl.js';

import {
  defineConformanceProbe,
  type ConformanceAdapterOptions,
  type ConformanceEntry,
} from './conformance-shared.js';

export const CHAIN_CONFORMANCE_PACK: readonly ConformanceEntry[] = [
  {
    probeId: 'P-AECHAIN-01',
    sidecarCheckId: 'P-CHAIN-01',
    title: 'Chain Step-Boundary-Logging',
    description:
      'Verifies each step of a documented chain has start/end timestamps and input/output hashes.',
    annexA: ['A.6.2.8'],
    clauses: ['8.3', '9.1'],
    tags: ['chain', 'audit-log'],
  },
  {
    probeId: 'P-AECHAIN-02',
    sidecarCheckId: 'P-CHAIN-02',
    title: 'Chain Authorization-At-Each-Step',
    description:
      'Verifies each step record carries an auth_check_id referencing a non-empty authorization decision.',
    annexA: ['A.7.4'],
    clauses: ['8.3'],
    tags: ['chain', 'authn'],
  },
  {
    probeId: 'P-AECHAIN-03',
    sidecarCheckId: 'P-CHAIN-03',
    title: 'Chain Idempotency-Keys-Honored',
    description:
      'Replays the same chain twice with the same idempotency key; second run returns the cached run id.',
    annexA: ['A.6.2.5', 'A.6.2.6'],
    clauses: ['8.3'],
    tags: ['chain', 'idempotency'],
  },
  {
    probeId: 'P-AECHAIN-04',
    sidecarCheckId: 'P-CHAIN-04',
    title: 'Chain Timeout-Bounded',
    description:
      'Verifies a chain probe-trigger request terminates with the documented timeout status.',
    annexA: ['A.6.2.5'],
    clauses: ['8.3'],
    tags: ['chain', 'sla'],
  },
  {
    probeId: 'P-AECHAIN-05',
    sidecarCheckId: 'P-CHAIN-05',
    title: 'Chain Inter-Step-Sanitization',
    description:
      'Verifies each step record carries a sanitization_id evidencing the documented schema validator.',
    annexA: ['A.6.2.5'],
    clauses: ['8.3'],
    tags: ['chain', 'schema'],
  },
];

export function buildChainConformancePack(
  options: ConformanceAdapterOptions,
): readonly AnyProbeDefinition[] {
  return CHAIN_CONFORMANCE_PACK.map((entry) =>
    defineConformanceProbe(entry, options, 'src/checks/chain-pack.ts'),
  );
}
