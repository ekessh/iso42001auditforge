// SPDX-License-Identifier: BUSL-1.1
import { createServer } from 'node:http';

const PORT = 4000;
const FIRM = 'firm-001';
const NOW = new Date().toISOString();

const ENGAGEMENTS = [
  {
    id: 'eng-001',
    firmId: FIRM,
    clientId: 'cli-001',
    mode: 'audit',
    stage: 'stage2',
    status: 'in_progress',
    scopeStatement: 'AIMS covering clinical decision support, radiology triage, and drug-discovery RAG agents',
    startsOn: '2026-04-15',
    endsOn: '2026-05-23',
    leadAuditorId: 'auditor-001',
    teamMemberIds: ['auditor-001'],
    aiSystemIds: ['ais-101', 'ais-102', 'ais-103'],
    auditDays: 18,
    spentDays: 11,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'eng-002',
    firmId: FIRM,
    clientId: 'cli-002',
    mode: 'audit',
    stage: 'surveillance',
    status: 'in_progress',
    scopeStatement: 'AIMS for trading model lifecycle, fairness monitoring, and customer-facing assistants',
    startsOn: '2026-05-01',
    endsOn: '2026-05-12',
    leadAuditorId: 'auditor-001',
    teamMemberIds: ['auditor-001'],
    aiSystemIds: ['ais-201'],
    auditDays: 7,
    spentDays: 3,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'eng-003',
    firmId: FIRM,
    clientId: 'cli-003',
    mode: 'readiness',
    stage: 'stage1',
    status: 'planned',
    scopeStatement: 'Readiness audit for AIMS pre-certification — autonomous mobile robots fleet',
    startsOn: '2026-05-20',
    endsOn: '2026-06-05',
    leadAuditorId: 'auditor-001',
    teamMemberIds: ['auditor-001'],
    aiSystemIds: ['ais-301'],
    auditDays: 12,
    spentDays: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const FINDINGS = [
  {
    id: 'fnd-001',
    firmId: FIRM,
    engagementId: 'eng-001',
    controlRef: '4.3',
    severity: 'major_nc',
    title: 'AIMS scope statement out of date',
    description: 'Scope statement does not reflect current AI systems in production.',
    evidence: ['ev-001', 'ev-002'],
    status: 'open',
    createdAt: '2026-04-22T09:00:00Z',
    updatedAt: '2026-04-22T09:00:00Z',
  },
  {
    id: 'fnd-002',
    firmId: FIRM,
    engagementId: 'eng-001',
    controlRef: '6.1.2',
    severity: 'minor_nc',
    title: 'Risk register lacks AI-specific threats',
    description: 'Threat catalogue missing AI-specific entries (model inversion, prompt injection).',
    evidence: ['ev-003'],
    status: 'open',
    createdAt: '2026-04-23T11:30:00Z',
    updatedAt: '2026-04-23T11:30:00Z',
  },
  {
    id: 'fnd-003',
    firmId: FIRM,
    engagementId: 'eng-001',
    controlRef: 'A.7.4',
    severity: 'ofi',
    title: 'Model card missing fairness metrics',
    description: 'Fairness section incomplete; no baseline disparate-impact ratio recorded.',
    evidence: [],
    status: 'capa_pending',
    createdAt: '2026-04-25T14:15:00Z',
    updatedAt: '2026-04-25T14:15:00Z',
  },
];

const CLIENTS = [
  {
    id: 'cli-001',
    firmId: FIRM,
    name: 'Atlas Diagnostics Inc.',
    metadata: { countryCode: 'US', activeEngagements: 1 },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cli-002',
    firmId: FIRM,
    name: 'Northwind Capital Markets',
    metadata: { countryCode: 'GB', activeEngagements: 1 },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cli-003',
    firmId: FIRM,
    name: 'Cinder Robotics',
    metadata: { countryCode: 'DE', activeEngagements: 1 },
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const PROBES = [
  {
    id: 'P-LLM-01',
    firmId: FIRM,
    name: 'System prompt frozen',
    category: 'P-LLM',
    mode: 'live',
    spec: { clauseRefs: ['A.6.2.4'], severity: 'medium' },
    budgetUsd: 5,
    cpuMs: 30000,
    memMb: 512,
    createdAt: NOW,
  },
  {
    id: 'P-MCP-01',
    firmId: FIRM,
    name: 'Tool catalogue validation',
    category: 'P-MCP',
    mode: 'live',
    spec: { clauseRefs: ['A.6.2.4'], severity: 'high' },
    budgetUsd: 5,
    cpuMs: 30000,
    memMb: 512,
    createdAt: NOW,
  },
  {
    id: 'AC-02',
    firmId: FIRM,
    name: 'Rate limit present',
    category: 'AC',
    mode: 'live',
    spec: { clauseRefs: ['A.8.4'], severity: 'medium' },
    budgetUsd: 1,
    cpuMs: 10000,
    memMb: 256,
    createdAt: NOW,
  },
];

const TRACES = [
  {
    id: 'trc-001',
    firmId: FIRM,
    name: 'LangGraph clinical-triage agent — 2026-04-26 08:00',
    metadata: {
      engagementId: 'eng-001',
      source: 'agent-runtime',
      framework: 'langgraph',
      spanCount: 124,
      capturedAt: '2026-04-26T08:00:00Z',
      sizeBytes: 482311,
    },
    createdAt: '2026-04-26T08:00:00Z',
    updatedAt: '2026-04-26T08:00:00Z',
  },
  {
    id: 'trc-002',
    firmId: FIRM,
    name: 'CrewAI marketing-research crew — 2026-04-27 14:30',
    metadata: {
      engagementId: 'eng-002',
      source: 'crewai',
      framework: 'crewai',
      spanCount: 89,
      capturedAt: '2026-04-27T14:30:00Z',
      sizeBytes: 312445,
    },
    createdAt: '2026-04-27T14:30:00Z',
    updatedAt: '2026-04-27T14:30:00Z',
  },
];

const LIBRARY = [
  {
    id: 'q-001',
    kind: 'question',
    ref: '4.1',
    title: 'Documented context of the organization',
    body: 'What is the documented context of the organization for AI?',
    tags: ['audit', 'readiness'],
  },
  {
    id: 'q-002',
    kind: 'question',
    ref: '6.1.2',
    title: 'AI-specific risk identification',
    body: 'How are AI-specific risks identified, evaluated, and treated?',
    tags: ['audit', 'readiness'],
  },
  {
    id: 'iso-4-3',
    kind: 'iso42001_clause',
    ref: '4.3',
    title: 'Determining the scope of the AI management system',
    body: 'The organization shall determine the boundaries and applicability of the AIMS.',
    tags: ['mandatory'],
  },
];

const COVERAGE = {
  'eng-001': {
    overallReadiness: 0.62,
    clauseStatuses: [
      { clauseRef: '4.1', status: 'evidenced', score: 1.0, weight: 1.5 },
      { clauseRef: '4.2', status: 'partial', score: 0.5, weight: 1.5 },
      { clauseRef: '6.1.2', status: 'contradicted', score: 0.0, weight: 1.5 },
      { clauseRef: 'A.6.2.4', status: 'evidenced', score: 1.0, weight: 1.0 },
      { clauseRef: 'A.7.4', status: 'partial', score: 0.5, weight: 1.0 },
    ],
    methodology: 'sum(weight * score) / sum(weight) per CLAUDE.md',
    computedAt: NOW,
  },
};

const CANDIDATE_FINDINGS = {
  'eng-001': [
    {
      id: 'cf-001',
      firmId: FIRM,
      engagementId: 'eng-001',
      draftTitle: 'Model card missing performance baselines',
      confidence: 0.91,
      sourceClaimIds: ['cl-104', 'cl-118'],
      suggestedClause: 'A.7.4',
      status: 'pending_review',
      createdAt: NOW,
    },
    {
      id: 'cf-002',
      firmId: FIRM,
      engagementId: 'eng-001',
      draftTitle: 'No documented fairness review cadence',
      confidence: 0.74,
      sourceClaimIds: ['cl-201'],
      suggestedClause: 'A.6.2.6',
      status: 'pending_review',
      createdAt: NOW,
    },
  ],
};

const page = (items) => ({ items, nextCursor: null, prevCursor: null });

const send = (res, status, body, originArg) => {
  const origin = originArg ?? res.__origin ?? 'http://localhost:3000';
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-request-id,traceparent,x-test-run,x-correlation-id',
    'vary': 'origin',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const routes = [
  ['GET', /^\/v1\/engagements\/?(\?.*)?$/, (req, res) => send(res, 200, page(ENGAGEMENTS))],
  ['GET', /^\/v1\/engagements\/([^/?]+)\/?$/, (req, res, m) => {
    const e = ENGAGEMENTS.find((x) => x.id === m[1]);
    return e ? send(res, 200, e) : send(res, 404, { error: 'not_found' });
  }],
  ['GET', /^\/v1\/engagements\/([^/]+)\/coverage\/?$/, (req, res, m) => send(res, 200, COVERAGE[m[1]] ?? COVERAGE['eng-001'])],
  ['GET', /^\/v1\/engagements\/([^/]+)\/candidate-findings\/?$/, (req, res, m) => send(res, 200, page(CANDIDATE_FINDINGS[m[1]] ?? []))],
  ['GET', /^\/v1\/engagements\/([^/]+)\/dashboard\/audit\/?$/, (req, res) => send(res, 200, { ...COVERAGE['eng-001'], mode: 'audit', candidateFindingsReviewed: 12, candidateFindingsTotal: 18 })],
  ['GET', /^\/v1\/engagements\/([^/]+)\/dashboard\/readiness\/?$/, (req, res) => send(res, 200, { ...COVERAGE['eng-001'], mode: 'readiness', disclaimer: 'NOT A CERTIFICATION AUDIT — readiness assessment only.' })],
  ['GET', /^\/v1\/findings\/?(\?.*)?$/, (req, res) => send(res, 200, page(FINDINGS))],
  ['GET', /^\/v1\/findings\/([^/?]+)\/?$/, (req, res, m) => {
    const f = FINDINGS.find((x) => x.id === m[1]);
    return f ? send(res, 200, f) : send(res, 404, { error: 'not_found' });
  }],
  ['GET', /^\/v1\/clients\/?(\?.*)?$/, (req, res) => send(res, 200, page(CLIENTS))],
  ['GET', /^\/v1\/clients\/([^/?]+)\/?$/, (req, res, m) => {
    const c = CLIENTS.find((x) => x.id === m[1]);
    return c ? send(res, 200, c) : send(res, 404, { error: 'not_found' });
  }],
  ['GET', /^\/v1\/probes\/executions\/?(\?.*)?$/, (req, res) => send(res, 200, page([]))],
  ['GET', /^\/v1\/probes\/?(\?.*)?$/, (req, res) => send(res, 200, page(PROBES))],
  ['GET', /^\/v1\/probes\/([^/?]+)\/?$/, (req, res, m) => {
    const p = PROBES.find((x) => x.id === m[1]);
    return p ? send(res, 200, p) : send(res, 404, { error: 'not_found' });
  }],
  ['GET', /^\/v1\/traces\/?(\?.*)?$/, (req, res) => send(res, 200, page(TRACES))],
  ['GET', /^\/v1\/traces\/([^/?]+)\/?$/, (req, res, m) => {
    const t = TRACES.find((x) => x.id === m[1]);
    return t ? send(res, 200, t) : send(res, 404, { error: 'not_found' });
  }],
  ['GET', /^\/v1\/library\/?(\?.*)?$/, (req, res) => send(res, 200, page(LIBRARY))],
  ['GET', /^\/v1\/working-papers\/?(\?.*)?$/, (req, res) => send(res, 200, page([]))],
  ['GET', /^\/v1\/peer-review\/?(\?.*)?$/, (req, res) => send(res, 200, page([]))],
  ['GET', /^\/v1\/qa-checklist\/?(\?.*)?$/, (req, res) => send(res, 200, page([]))],
  ['POST', /^\/v1\/identity\/logout\/?$/, (req, res) => send(res, 200, { ok: true })],
  ['GET', /^\/healthz\/?$/, (req, res) => send(res, 200, { status: 'ok', mode: 'dev-mock' })],
];

const server = createServer((req, res) => {
  const origin = req.headers.origin || 'http://localhost:3000';
  res.__origin = origin;
  if (req.method === 'OPTIONS') return send(res, 204, '', origin);
  for (const [method, regex, handler] of routes) {
    if (req.method !== method) continue;
    const m = req.url.match(regex);
    if (m) {
      console.log(`[mock] ${req.method} ${req.url} (origin=${origin})`);
      return handler(req, res, m);
    }
  }
  console.log(`[mock] 404 ${req.method} ${req.url}`);
  return send(res, 404, { error: 'route_not_found', method: req.method, path: req.url }, origin);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[dev-mock-api] listening on http://localhost:${PORT}`);
});
