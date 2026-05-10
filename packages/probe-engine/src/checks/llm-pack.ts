// SPDX-License-Identifier: BUSL-1.1
import type { AnyProbeDefinition } from '../dsl.js';

import {
  defineConformanceProbe,
  type ConformanceAdapterOptions,
  type ConformanceEntry,
} from './conformance-shared.js';

export const LLM_CONFORMANCE_PACK: readonly ConformanceEntry[] = [
  {
    probeId: 'P-AELLM-01',
    sidecarCheckId: 'P-LLM-01',
    title: 'LLM System-Prompt-Frozen',
    description:
      'Issues N requests and verifies every response returns the same system-prompt fingerprint.',
    annexA: ['A.6.2.7', 'A.6.2.8'],
    clauses: ['7.5', '8.2'],
    externalRefs: [{ framework: 'NIST-AI-RMF', id: 'MEASURE-2.7' }],
    tags: ['llm', 'provenance'],
  },
  {
    probeId: 'P-AELLM-02',
    sidecarCheckId: 'P-LLM-02',
    title: 'LLM Output-Length-Bounded',
    description:
      'Drives a prompt expected to exceed the documented max-output-tokens cap and verifies the response respects the bound.',
    annexA: ['A.6.2.5'],
    clauses: ['8.3'],
    tags: ['llm', 'guardrails'],
  },
  {
    probeId: 'P-AELLM-03',
    sidecarCheckId: 'P-LLM-03',
    title: 'LLM Refusal-On-Documented-Out-Of-Scope',
    description:
      'Feeds prompts auditee documented as out-of-scope; verifies the model refuses.',
    annexA: ['A.6.2.5', 'A.9.4'],
    clauses: ['6.1.4', '8.3'],
    tags: ['llm', 'scope'],
  },
  {
    probeId: 'P-AELLM-04',
    sidecarCheckId: 'P-LLM-04',
    title: 'LLM Determinism-At-Zero-Temp',
    description:
      'Drives the same prompt twice at temperature=0 and verifies outputs match.',
    annexA: ['A.6.2.4'],
    clauses: ['8.3', '9.1'],
    tags: ['llm', 'determinism'],
  },
  {
    probeId: 'P-AELLM-05',
    sidecarCheckId: 'P-LLM-05',
    title: 'LLM Citation-Present',
    description: 'Verifies a RAG response includes the documented citation field.',
    annexA: ['A.7.5', 'A.8.2'],
    clauses: ['7.5'],
    externalRefs: [{ framework: 'EU-AI-Act', id: 'Article-13' }],
    tags: ['llm', 'rag', 'transparency'],
  },
  {
    probeId: 'P-AELLM-06',
    sidecarCheckId: 'P-LLM-06',
    title: 'LLM No-Training-Data-Leakage',
    description:
      'Sends canary prompts and asserts no exact-match of any training-data fingerprint string.',
    annexA: ['A.7.4', 'A.7.5'],
    clauses: ['8.3'],
    externalRefs: [{ framework: 'OWASP-LLM-Top10', id: 'LLM06' }],
    tags: ['llm', 'leakage'],
  },
  {
    probeId: 'P-AELLM-07',
    sidecarCheckId: 'P-LLM-07',
    title: 'LLM Provider-Switching-Stability',
    description:
      'Verifies the documented multi-provider fallback path yields a successful response with the secondary-provider header.',
    annexA: ['A.6.2.5', 'A.10.3'],
    clauses: ['6.1.3', '8.3'],
    tags: ['llm', 'resilience'],
  },
  {
    probeId: 'P-AELLM-08',
    sidecarCheckId: 'P-LLM-08',
    title: 'LLM Cost-Cap-Per-Request',
    description:
      'Verifies the documented per-request cost cap terminates a probe request with the documented status.',
    annexA: ['A.6.2.6', 'A.10.3'],
    clauses: ['8.3'],
    tags: ['llm', 'cost-controls'],
  },
  {
    probeId: 'P-AELLM-09',
    sidecarCheckId: 'P-LLM-09',
    title: 'LLM Inference-Latency-Bounded',
    description:
      'Times cold + warm latencies and verifies they stay under the documented SLA.',
    annexA: ['A.6.2.6'],
    clauses: ['8.3', '9.1'],
    tags: ['llm', 'sla'],
  },
  {
    probeId: 'P-AELLM-10',
    sidecarCheckId: 'P-LLM-10',
    title: 'LLM Model-Version-Pinned',
    description:
      'Verifies the model-version header in the response matches the documented pin.',
    annexA: ['A.6.2.7'],
    clauses: ['7.5', '8.3'],
    tags: ['llm', 'provenance'],
  },
];

export function buildLlmConformancePack(
  options: ConformanceAdapterOptions,
): readonly AnyProbeDefinition[] {
  return LLM_CONFORMANCE_PACK.map((entry) =>
    defineConformanceProbe(entry, options, 'src/checks/llm-pack.ts'),
  );
}

export type { ConformanceAdapterOptions, ConformanceEntry } from './conformance-shared.js';
