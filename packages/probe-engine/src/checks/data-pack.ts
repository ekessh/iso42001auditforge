// SPDX-License-Identifier: BUSL-1.1
import type { AnyProbeDefinition } from '../dsl.js';

import {
  defineConformanceProbe,
  type ConformanceAdapterOptions,
  type ConformanceEntry,
} from './conformance-shared.js';

export const DATA_CONFORMANCE_PACK: readonly ConformanceEntry[] = [
  {
    probeId: 'P-AEDATA-01',
    sidecarCheckId: 'P-DATA-01',
    title: 'Training-Data-Provenance',
    description:
      'Verifies training-dataset metadata includes source, license, collection date, version, and integrity hash.',
    annexA: ['A.7.2', 'A.7.5'],
    clauses: ['7.5'],
    tags: ['data', 'provenance'],
  },
  {
    probeId: 'P-AEDATA-02',
    sidecarCheckId: 'P-DATA-02',
    title: 'Data-Subject-Rights',
    description:
      'Verifies the documented data-subject endpoints (enumerate, rectify, erase) respond successfully.',
    annexA: ['A.7.4'],
    clauses: ['7.5', '8.3'],
    externalRefs: [
      { framework: 'EU-AI-Act', id: 'Article-26' },
      { framework: 'GDPR', id: 'Article-15' },
    ],
    tags: ['data', 'gdpr'],
  },
  {
    probeId: 'P-AEDATA-03',
    sidecarCheckId: 'P-DATA-03',
    title: 'Data-Quality-Metrics-Logged',
    description:
      'Verifies the data-pipeline metrics endpoint returns completeness, validity, and freshness.',
    annexA: ['A.7.4', 'A.7.6'],
    clauses: ['7.5', '9.1'],
    tags: ['data', 'quality'],
  },
  {
    probeId: 'P-AEDATA-04',
    sidecarCheckId: 'P-DATA-04',
    title: 'PII-Tagging-On-Ingestion',
    description:
      'Verifies persisted records carry PII tags on the documented fields.',
    annexA: ['A.7.4'],
    clauses: ['7.5', '8.3'],
    tags: ['data', 'pii'],
  },
  {
    probeId: 'P-AEDATA-05',
    sidecarCheckId: 'P-DATA-05',
    title: 'Retention-Schedule-Active',
    description:
      'Verifies the active store contains no records past the documented retention age.',
    annexA: ['A.7.4', 'A.7.6'],
    clauses: ['7.5', '8.3'],
    externalRefs: [{ framework: 'GDPR', id: 'Article-5' }],
    tags: ['data', 'retention'],
  },
  {
    probeId: 'P-AEDATA-06',
    sidecarCheckId: 'P-DATA-06',
    title: 'Cross-Border-Transfer-Documented',
    description:
      'Verifies data-residency markers match the auditee\'s documented allowlist.',
    annexA: ['A.7.5', 'A.10.3'],
    clauses: ['7.5'],
    externalRefs: [
      { framework: 'GDPR', id: 'Chapter-V' },
      { framework: 'EU-AI-Act', id: 'Article-25' },
    ],
    tags: ['data', 'residency'],
  },
  {
    probeId: 'P-AEDATA-07',
    sidecarCheckId: 'P-DATA-07',
    title: 'Synthetic-Data-Disclosure',
    description:
      'Verifies synthetic-data datasets carry explicit disclosure metadata.',
    annexA: ['A.7.5', 'A.7.6'],
    clauses: ['7.5'],
    externalRefs: [{ framework: 'EU-AI-Act', id: 'Article-50' }],
    tags: ['data', 'transparency'],
  },
  {
    probeId: 'P-AEDATA-08',
    sidecarCheckId: 'P-DATA-08',
    title: 'Dataset-Versioning',
    description:
      'Verifies the dataset version pin in production matches the latest model card.',
    annexA: ['A.7.5', 'A.6.2.7'],
    clauses: ['7.5', '8.3'],
    tags: ['data', 'versioning'],
  },
];

export function buildDataConformancePack(
  options: ConformanceAdapterOptions,
): readonly AnyProbeDefinition[] {
  return DATA_CONFORMANCE_PACK.map((entry) =>
    defineConformanceProbe(entry, options, 'src/checks/data-pack.ts'),
  );
}
