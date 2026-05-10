// SPDX-License-Identifier: BUSL-1.1
/*
 * AuditForge dev mock API — read/write with on-disk persistence.
 *
 * Persistence:
 *   - State file: scripts/dev-mock-data/state.json
 *   - Loaded on startup; mutations debounce-write (200ms) to disk.
 *   - Pass `--reset` to delete the state file and re-seed from in-file fixtures.
 *
 * GET    /healthz
 * GET    /v1/engagements                                  (list)
 * POST   /v1/engagements                                  (create — schema parity with CreateEngagementSchema)
 * GET    /v1/engagements/:id
 * PATCH  /v1/engagements/:id                              (partial update)
 * DELETE /v1/engagements/:id                              (soft — sets metadata.archived)
 * GET    /v1/engagements/:id/coverage
 * GET    /v1/engagements/:id/dashboard/audit
 * GET    /v1/engagements/:id/dashboard/readiness
 * GET    /v1/engagements/:id/audit-trail                  (synthesizes seed events on first read)
 * GET    /v1/engagements/:id/candidate-findings
 * POST   /v1/engagements/:id/candidate-findings/:cfId/promote
 * POST   /v1/engagements/:id/candidate-findings/:cfId/dismiss
 *
 * GET    /v1/findings                                     (list, supports ?engagementId=)
 * POST   /v1/findings
 * GET    /v1/findings/:id
 * PATCH  /v1/findings/:id
 * POST   /v1/findings/:id/promote                          (status=open)
 * POST   /v1/findings/:id/capa                             (status=capa_pending)
 * DELETE /v1/findings/:id
 *
 * GET    /v1/clients
 * POST   /v1/clients
 * GET    /v1/clients/:id
 * PATCH  /v1/clients/:id
 * DELETE /v1/clients/:id
 *
 * GET    /v1/probes
 * GET    /v1/probes/:id
 * GET    /v1/probes/executions?engagementId=...
 * POST   /v1/probes/executions                             (queued -> success after 2s)
 *
 * GET    /v1/traces
 * GET    /v1/traces/:id
 * POST   /v1/traces                                        (multipart/form-data, file field; metadata only)
 *
 * GET    /v1/working-papers
 * POST   /v1/working-papers
 * PATCH  /v1/working-papers/:id
 *
 * GET    /v1/library?q=&kind=&limit=&offset=
 *
 * POST   /v1/reports/draft                                 (returns draft stub)
 * GET    /v1/peer-review
 * GET    /v1/qa-checklist
 * POST   /v1/identity/logout
 *
 * Audit ledger: every mutation calls emitEvent() — sha256 hash-chained, signed
 * with synthetic key id `auditforge-dev-key-001`. Events are scoped per
 * engagement and exposed via /v1/engagements/:id/audit-trail.
 *
 * Concurrency: a single in-memory promise mutex serialises mutations so
 * concurrent POSTs cannot race on hash-chain prevHash.
 */

import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 4000;
const FIRM = 'firm-001';
const SIGNER_KEY_ID = 'auditforge-dev-key-001';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, 'dev-mock-data');
const STATE_FILE = resolve(DATA_DIR, 'state.json');

const NOW = () => new Date().toISOString();
const newId = (prefix) => `${prefix}-${randomUUID().slice(0, 8)}`;

function seedState() {
  const t = NOW();
  return {
    engagements: [
      {
        id: 'eng-001', firmId: FIRM, clientId: 'cli-001', mode: 'audit', stage: 'stage2',
        status: 'in_progress',
        scopeStatement: 'AIMS covering clinical decision support, radiology triage, and drug-discovery RAG agents',
        startsOn: '2026-04-15', endsOn: '2026-05-23',
        leadAuditorId: 'auditor-001', teamMemberIds: ['auditor-001'],
        aiSystemIds: ['ais-101', 'ais-102', 'ais-103'],
        auditDays: 18, spentDays: 11, createdAt: t, updatedAt: t,
      },
      {
        id: 'eng-002', firmId: FIRM, clientId: 'cli-002', mode: 'audit', stage: 'surveillance',
        status: 'in_progress',
        scopeStatement: 'AIMS for trading model lifecycle, fairness monitoring, and customer-facing assistants',
        startsOn: '2026-05-01', endsOn: '2026-05-12',
        leadAuditorId: 'auditor-001', teamMemberIds: ['auditor-001'],
        aiSystemIds: ['ais-201'], auditDays: 7, spentDays: 3, createdAt: t, updatedAt: t,
      },
      {
        id: 'eng-003', firmId: FIRM, clientId: 'cli-003', mode: 'readiness', stage: 'stage1',
        status: 'planned',
        scopeStatement: 'Readiness audit for AIMS pre-certification — autonomous mobile robots fleet',
        startsOn: '2026-05-20', endsOn: '2026-06-05',
        leadAuditorId: 'auditor-001', teamMemberIds: ['auditor-001'],
        aiSystemIds: ['ais-301'], auditDays: 12, spentDays: 0, createdAt: t, updatedAt: t,
      },
    ],
    findings: [
      {
        id: 'fnd-001', firmId: FIRM, engagementId: 'eng-001', controlRef: '4.3',
        severity: 'major_nc', title: 'AIMS scope statement out of date',
        description: 'Scope statement does not reflect current AI systems in production.',
        evidence: ['ev-001', 'ev-002'], status: 'open',
        createdAt: '2026-04-22T09:00:00Z', updatedAt: '2026-04-22T09:00:00Z',
      },
      {
        id: 'fnd-002', firmId: FIRM, engagementId: 'eng-001', controlRef: '6.1.2',
        severity: 'minor_nc', title: 'Risk register lacks AI-specific threats',
        description: 'Threat catalogue missing AI-specific entries (model inversion, prompt injection).',
        evidence: ['ev-003'], status: 'open',
        createdAt: '2026-04-23T11:30:00Z', updatedAt: '2026-04-23T11:30:00Z',
      },
      {
        id: 'fnd-003', firmId: FIRM, engagementId: 'eng-001', controlRef: 'A.7.4',
        severity: 'ofi', title: 'Model card missing fairness metrics',
        description: 'Fairness section incomplete; no baseline disparate-impact ratio recorded.',
        evidence: [], status: 'capa_pending',
        createdAt: '2026-04-25T14:15:00Z', updatedAt: '2026-04-25T14:15:00Z',
      },
    ],
    clients: [
      { id: 'cli-001', firmId: FIRM, name: 'Atlas Diagnostics Inc.', metadata: { countryCode: 'US', activeEngagements: 1 }, createdAt: t, updatedAt: t },
      { id: 'cli-002', firmId: FIRM, name: 'Northwind Capital Markets', metadata: { countryCode: 'GB', activeEngagements: 1 }, createdAt: t, updatedAt: t },
      { id: 'cli-003', firmId: FIRM, name: 'Cinder Robotics', metadata: { countryCode: 'DE', activeEngagements: 1 }, createdAt: t, updatedAt: t },
    ],
    probes: [
      { id: 'P-LLM-01', firmId: FIRM, name: 'System prompt frozen', category: 'P-LLM', mode: 'live', spec: { clauseRefs: ['A.6.2.4'], severity: 'medium' }, budgetUsd: 5, cpuMs: 30000, memMb: 512, createdAt: t },
      { id: 'P-MCP-01', firmId: FIRM, name: 'Tool catalogue validation', category: 'P-MCP', mode: 'live', spec: { clauseRefs: ['A.6.2.4'], severity: 'high' }, budgetUsd: 5, cpuMs: 30000, memMb: 512, createdAt: t },
      { id: 'AC-02', firmId: FIRM, name: 'Rate limit present', category: 'AC', mode: 'live', spec: { clauseRefs: ['A.8.4'], severity: 'medium' }, budgetUsd: 1, cpuMs: 10000, memMb: 256, createdAt: t },
    ],
    probeExecutions: [],
    traces: [
      {
        id: 'trc-001', firmId: FIRM,
        name: 'LangGraph clinical-triage agent — 2026-04-26 08:00',
        metadata: { engagementId: 'eng-001', source: 'agent-runtime', framework: 'langgraph', spanCount: 124, capturedAt: '2026-04-26T08:00:00Z', sizeBytes: 482311 },
        createdAt: '2026-04-26T08:00:00Z', updatedAt: '2026-04-26T08:00:00Z',
      },
      {
        id: 'trc-002', firmId: FIRM,
        name: 'CrewAI marketing-research crew — 2026-04-27 14:30',
        metadata: { engagementId: 'eng-002', source: 'crewai', framework: 'crewai', spanCount: 89, capturedAt: '2026-04-27T14:30:00Z', sizeBytes: 312445 },
        createdAt: '2026-04-27T14:30:00Z', updatedAt: '2026-04-27T14:30:00Z',
      },
    ],
    library: [
      { id: 'q-001', kind: 'question', ref: '4.1', title: 'Documented context of the organization', body: 'What is the documented context of the organization for AI?', tags: ['audit', 'readiness'] },
      { id: 'q-002', kind: 'question', ref: '6.1.2', title: 'AI-specific risk identification', body: 'How are AI-specific risks identified, evaluated, and treated?', tags: ['audit', 'readiness'] },
      { id: 'iso-4-3', kind: 'iso42001_clause', ref: '4.3', title: 'Determining the scope of the AI management system', body: 'The organization shall determine the boundaries and applicability of the AIMS.', tags: ['mandatory'] },
    ],
    coverage: {
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
        computedAt: t,
      },
    },
    candidateFindings: {
      'eng-001': [
        { id: 'cf-001', firmId: FIRM, engagementId: 'eng-001', draftTitle: 'Model card missing performance baselines', confidence: 0.91, sourceClaimIds: ['cl-104', 'cl-118'], suggestedClause: 'A.7.4', status: 'pending_review', createdAt: t },
        { id: 'cf-002', firmId: FIRM, engagementId: 'eng-001', draftTitle: 'No documented fairness review cadence', confidence: 0.74, sourceClaimIds: ['cl-201'], suggestedClause: 'A.6.2.6', status: 'pending_review', createdAt: t },
      ],
    },
    workingPapers: [],
    auditEvents: {},
  };
}

let STATE = seedState();

function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      const raw = readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      STATE = { ...seedState(), ...parsed };
      console.log(`[mock] loaded state from ${STATE_FILE}`);
      return;
    }
  } catch (err) {
    console.warn(`[mock] could not load state file (${err.message}); seeding fresh`);
  }
  STATE = seedState();
  console.log('[mock] seeded fresh state from in-file fixtures');
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(STATE_FILE, JSON.stringify(STATE, null, 2), 'utf8');
    } catch (err) {
      console.error(`[mock] persist failed: ${err.message}`);
    }
    saveTimer = null;
  }, 200);
}

let mutex = Promise.resolve();
function withMutation(fn) {
  const next = mutex.then(async () => {
    const result = await fn();
    scheduleSave();
    return result;
  });
  mutex = next.catch(() => {});
  return next;
}

function emitEvent(engagementId, kind, payload) {
  if (!STATE.auditEvents[engagementId]) STATE.auditEvents[engagementId] = [];
  const list = STATE.auditEvents[engagementId];
  const prev = list[list.length - 1];
  const prevHash = prev ? prev.chainHash : '0'.repeat(64);
  const ts = NOW();
  const id = newId('evt');
  const chainHash = createHash('sha256').update(prevHash + kind + JSON.stringify(payload) + ts).digest('hex');
  const event = { id, engagementId, kind, payload, chainHash, prevHash, ts, signerKeyId: SIGNER_KEY_ID };
  list.push(event);
  return event;
}

function ensureSeedAuditTrail(engagementId) {
  if (STATE.auditEvents[engagementId] && STATE.auditEvents[engagementId].length > 0) return;
  const eng = STATE.engagements.find((e) => e.id === engagementId);
  if (!eng) return;
  emitEvent(engagementId, 'engagement.created', { id: eng.id, clientId: eng.clientId, mode: eng.mode, stage: eng.stage });
  emitEvent(engagementId, 'engagement.scope.locked', { scopeStatement: eng.scopeStatement });
  for (const f of STATE.findings.filter((x) => x.engagementId === engagementId)) {
    emitEvent(engagementId, 'finding.raised', { id: f.id, severity: f.severity, controlRef: f.controlRef, title: f.title });
  }
}

const page = (items) => ({ items, nextCursor: null, prevCursor: null });

function send(res, status, body, originArg) {
  const origin = originArg ?? res.__origin ?? 'http://localhost:3000';
  const headers = {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-request-id,traceparent,x-test-run,x-correlation-id',
    'vary': 'origin',
  };
  if (status === 204) {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  headers['content-type'] = 'application/json';
  res.writeHead(status, headers);
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req);
  if (buf.length === 0) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    const e = new Error('invalid_json');
    e.status = 400;
    throw e;
  }
}

function validateBody(body, required) {
  if (!body || typeof body !== 'object') {
    return { ok: false, missing: required };
  }
  const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === '');
  return { ok: missing.length === 0, missing };
}

function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx < 0) return {};
  const out = {};
  for (const part of url.slice(idx + 1).split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

// Multipart parser sufficient for a single `file` field with a filename.
// Tracks only filename + size; we deliberately do not persist file bytes.
function parseMultipartFilename(buf, contentType) {
  const m = /boundary=(.+)$/.exec(contentType || '');
  if (!m) return null;
  const boundary = `--${m[1]}`;
  const text = buf.toString('binary');
  const parts = text.split(boundary);
  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd < 0) continue;
    const headers = part.slice(0, headerEnd);
    const fnMatch = /filename="([^"]+)"/.exec(headers);
    if (!fnMatch) continue;
    const body = part.slice(headerEnd + 4, part.length - 2);
    return { filename: fnMatch[1], size: Buffer.byteLength(body, 'binary') };
  }
  return null;
}

let reqCounter = 0;

const routes = [
  ['GET', /^\/healthz\/?$/, (req, res) => send(res, 200, { status: 'ok', mode: 'dev-mock' })],

  ['GET', /^\/v1\/engagements\/?(\?.*)?$/, (req, res) => {
    const visible = STATE.engagements.filter((e) => !e.metadata?.archived);
    return send(res, 200, page(visible));
  }],
  ['POST', /^\/v1\/engagements\/?$/, async (req, res) => {
    const body = await readJson(req);
    const v = validateBody(body, ['clientId', 'mode', 'stage', 'scopeStatement', 'startsOn', 'endsOn', 'leadAuditorId']);
    if (!v.ok) return send(res, 400, { error: 'invalid_body', message: 'missing required fields', missing: v.missing });
    return withMutation(() => {
      const t = NOW();
      const eng = {
        id: newId('eng'), firmId: FIRM, clientId: body.clientId,
        mode: body.mode, stage: body.stage, status: body.status ?? 'planned',
        scopeStatement: body.scopeStatement,
        startsOn: body.startsOn, endsOn: body.endsOn,
        leadAuditorId: body.leadAuditorId,
        teamMemberIds: body.teamMemberIds ?? [],
        aiSystemIds: body.aiSystemIds ?? [],
        auditDays: body.auditDays ?? 0, spentDays: 0,
        metadata: body.metadata ?? {},
        createdAt: t, updatedAt: t,
      };
      STATE.engagements.push(eng);
      emitEvent(eng.id, 'engagement.created', { id: eng.id, clientId: eng.clientId, mode: eng.mode, stage: eng.stage });
      return send(res, 201, eng);
    });
  }],
  ['GET', /^\/v1\/engagements\/([^/?]+)\/?$/, (req, res, m) => {
    const e = STATE.engagements.find((x) => x.id === m[1]);
    return e ? send(res, 200, e) : send(res, 404, { error: 'not_found', message: `engagement ${m[1]} not found` });
  }],
  ['PATCH', /^\/v1\/engagements\/([^/?]+)\/?$/, async (req, res, m) => {
    const body = await readJson(req);
    return withMutation(() => {
      const idx = STATE.engagements.findIndex((x) => x.id === m[1]);
      if (idx < 0) return send(res, 404, { error: 'not_found', message: `engagement ${m[1]} not found` });
      const updated = { ...STATE.engagements[idx], ...body, id: STATE.engagements[idx].id, firmId: FIRM, updatedAt: NOW() };
      STATE.engagements[idx] = updated;
      emitEvent(updated.id, 'engagement.updated', { fields: Object.keys(body) });
      return send(res, 200, updated);
    });
  }],
  ['DELETE', /^\/v1\/engagements\/([^/?]+)\/?$/, async (req, res, m) => {
    return withMutation(() => {
      const idx = STATE.engagements.findIndex((x) => x.id === m[1]);
      if (idx < 0) return send(res, 404, { error: 'not_found', message: `engagement ${m[1]} not found` });
      const eng = STATE.engagements[idx];
      eng.metadata = { ...(eng.metadata ?? {}), archived: true, archivedAt: NOW() };
      eng.status = 'archived';
      eng.updatedAt = NOW();
      emitEvent(eng.id, 'engagement.archived', { id: eng.id });
      return send(res, 204, '');
    });
  }],
  ['GET', /^\/v1\/engagements\/([^/]+)\/coverage\/?$/, (req, res, m) =>
    send(res, 200, STATE.coverage[m[1]] ?? STATE.coverage['eng-001'])],
  ['GET', /^\/v1\/engagements\/([^/]+)\/dashboard\/audit\/?$/, (req, res) =>
    send(res, 200, { ...STATE.coverage['eng-001'], mode: 'audit', candidateFindingsReviewed: 12, candidateFindingsTotal: 18 })],
  ['GET', /^\/v1\/engagements\/([^/]+)\/dashboard\/readiness\/?$/, (req, res) =>
    send(res, 200, { ...STATE.coverage['eng-001'], mode: 'readiness', disclaimer: 'NOT A CERTIFICATION AUDIT — readiness assessment only.' })],
  ['GET', /^\/v1\/engagements\/([^/]+)\/audit-trail\/?(\?.*)?$/, async (req, res, m) => {
    return withMutation(() => {
      const eng = STATE.engagements.find((x) => x.id === m[1]);
      if (!eng) return send(res, 404, { error: 'not_found', message: `engagement ${m[1]} not found` });
      ensureSeedAuditTrail(m[1]);
      return send(res, 200, page(STATE.auditEvents[m[1]] ?? []));
    });
  }],
  ['GET', /^\/v1\/engagements\/([^/]+)\/candidate-findings\/?$/, (req, res, m) =>
    send(res, 200, page(STATE.candidateFindings[m[1]] ?? []))],
  ['POST', /^\/v1\/engagements\/([^/]+)\/candidate-findings\/([^/]+)\/promote\/?$/, async (req, res, m) => {
    const body = await readJson(req);
    return withMutation(() => {
      const list = STATE.candidateFindings[m[1]] ?? [];
      const idx = list.findIndex((x) => x.id === m[2]);
      if (idx < 0) return send(res, 404, { error: 'not_found', message: `candidate-finding ${m[2]} not found` });
      const cf = list[idx];
      const t = NOW();
      const finding = {
        id: newId('fnd'), firmId: FIRM, engagementId: m[1],
        controlRef: body.controlRef ?? cf.suggestedClause ?? '4.3',
        severity: body.severity ?? 'minor_nc',
        title: body.title ?? cf.draftTitle,
        description: body.description ?? cf.draftTitle,
        evidence: [], status: 'open', createdAt: t, updatedAt: t,
      };
      STATE.findings.push(finding);
      cf.status = 'promoted';
      cf.promotedFindingId = finding.id;
      list.splice(idx, 1);
      STATE.candidateFindings[m[1]] = list;
      emitEvent(m[1], 'candidate_finding.promoted', { candidateFindingId: cf.id, findingId: finding.id });
      emitEvent(m[1], 'finding.raised', { id: finding.id, severity: finding.severity, controlRef: finding.controlRef });
      return send(res, 200, { findingId: finding.id, finding });
    });
  }],
  ['POST', /^\/v1\/engagements\/([^/]+)\/candidate-findings\/([^/]+)\/dismiss\/?$/, async (req, res, m) => {
    const body = await readJson(req);
    const v = validateBody(body, ['rationale']);
    if (!v.ok) return send(res, 400, { error: 'invalid_body', message: 'rationale required', missing: v.missing });
    return withMutation(() => {
      const list = STATE.candidateFindings[m[1]] ?? [];
      const cf = list.find((x) => x.id === m[2]);
      if (!cf) return send(res, 404, { error: 'not_found', message: `candidate-finding ${m[2]} not found` });
      cf.status = 'dismissed';
      cf.dismissalRationale = body.rationale;
      cf.dismissedAt = NOW();
      emitEvent(m[1], 'candidate_finding.dismissed', { candidateFindingId: cf.id, rationale: body.rationale });
      return send(res, 200, cf);
    });
  }],

  ['GET', /^\/v1\/findings\/?(\?.*)?$/, (req, res) => {
    const q = parseQuery(req.url);
    let items = STATE.findings;
    if (q.engagementId) items = items.filter((f) => f.engagementId === q.engagementId);
    return send(res, 200, page(items));
  }],
  ['POST', /^\/v1\/findings\/?$/, async (req, res) => {
    const body = await readJson(req);
    const v = validateBody(body, ['severity', 'title', 'description', 'controlRef', 'engagementId']);
    if (!v.ok) return send(res, 400, { error: 'invalid_body', message: 'missing required fields', missing: v.missing });
    return withMutation(() => {
      const t = NOW();
      const f = {
        id: newId('fnd'), firmId: FIRM,
        engagementId: body.engagementId, controlRef: body.controlRef,
        severity: body.severity, title: body.title, description: body.description,
        evidence: body.evidence ?? [], status: body.status ?? 'open',
        createdAt: t, updatedAt: t,
      };
      STATE.findings.push(f);
      emitEvent(f.engagementId, 'finding.raised', { id: f.id, severity: f.severity, controlRef: f.controlRef, title: f.title });
      return send(res, 201, f);
    });
  }],
  ['GET', /^\/v1\/findings\/([^/?]+)\/?$/, (req, res, m) => {
    const f = STATE.findings.find((x) => x.id === m[1]);
    return f ? send(res, 200, f) : send(res, 404, { error: 'not_found', message: `finding ${m[1]} not found` });
  }],
  ['PATCH', /^\/v1\/findings\/([^/?]+)\/?$/, async (req, res, m) => {
    const body = await readJson(req);
    return withMutation(() => {
      const idx = STATE.findings.findIndex((x) => x.id === m[1]);
      if (idx < 0) return send(res, 404, { error: 'not_found', message: `finding ${m[1]} not found` });
      const updated = { ...STATE.findings[idx], ...body, id: STATE.findings[idx].id, firmId: FIRM, updatedAt: NOW() };
      STATE.findings[idx] = updated;
      emitEvent(updated.engagementId, 'finding.updated', { id: updated.id, fields: Object.keys(body) });
      return send(res, 200, updated);
    });
  }],
  ['POST', /^\/v1\/findings\/([^/?]+)\/promote\/?$/, async (req, res, m) => {
    return withMutation(() => {
      const idx = STATE.findings.findIndex((x) => x.id === m[1]);
      if (idx < 0) return send(res, 404, { error: 'not_found', message: `finding ${m[1]} not found` });
      const f = STATE.findings[idx];
      f.status = 'open';
      f.promotedAt = NOW();
      f.updatedAt = NOW();
      emitEvent(f.engagementId, 'finding.promoted', { id: f.id });
      return send(res, 200, f);
    });
  }],
  ['POST', /^\/v1\/findings\/([^/?]+)\/capa\/?$/, async (req, res, m) => {
    const body = await readJson(req);
    const v = validateBody(body, ['capaPlan', 'targetDate']);
    if (!v.ok) return send(res, 400, { error: 'invalid_body', message: 'capaPlan + targetDate required', missing: v.missing });
    return withMutation(() => {
      const idx = STATE.findings.findIndex((x) => x.id === m[1]);
      if (idx < 0) return send(res, 404, { error: 'not_found', message: `finding ${m[1]} not found` });
      const f = STATE.findings[idx];
      f.status = 'capa_pending';
      f.capaPlan = body.capaPlan;
      f.capaTargetDate = body.targetDate;
      f.updatedAt = NOW();
      emitEvent(f.engagementId, 'finding.capa_assigned', { id: f.id, targetDate: body.targetDate });
      return send(res, 200, f);
    });
  }],
  ['DELETE', /^\/v1\/findings\/([^/?]+)\/?$/, async (req, res, m) => {
    return withMutation(() => {
      const idx = STATE.findings.findIndex((x) => x.id === m[1]);
      if (idx < 0) return send(res, 404, { error: 'not_found', message: `finding ${m[1]} not found` });
      const [removed] = STATE.findings.splice(idx, 1);
      emitEvent(removed.engagementId, 'finding.deleted', { id: removed.id });
      return send(res, 204, '');
    });
  }],

  ['GET', /^\/v1\/clients\/?(\?.*)?$/, (req, res) => send(res, 200, page(STATE.clients))],
  ['POST', /^\/v1\/clients\/?$/, async (req, res) => {
    const body = await readJson(req);
    const v = validateBody(body, ['name']);
    if (!v.ok) return send(res, 400, { error: 'invalid_body', message: 'name required', missing: v.missing });
    return withMutation(() => {
      const t = NOW();
      const c = { id: newId('cli'), firmId: FIRM, name: body.name, metadata: body.metadata ?? {}, createdAt: t, updatedAt: t };
      STATE.clients.push(c);
      return send(res, 201, c);
    });
  }],
  ['GET', /^\/v1\/clients\/([^/?]+)\/?$/, (req, res, m) => {
    const c = STATE.clients.find((x) => x.id === m[1]);
    return c ? send(res, 200, c) : send(res, 404, { error: 'not_found', message: `client ${m[1]} not found` });
  }],
  ['PATCH', /^\/v1\/clients\/([^/?]+)\/?$/, async (req, res, m) => {
    const body = await readJson(req);
    return withMutation(() => {
      const idx = STATE.clients.findIndex((x) => x.id === m[1]);
      if (idx < 0) return send(res, 404, { error: 'not_found', message: `client ${m[1]} not found` });
      const updated = { ...STATE.clients[idx], ...body, id: STATE.clients[idx].id, firmId: FIRM, updatedAt: NOW() };
      STATE.clients[idx] = updated;
      return send(res, 200, updated);
    });
  }],
  ['DELETE', /^\/v1\/clients\/([^/?]+)\/?$/, async (req, res, m) => {
    return withMutation(() => {
      const idx = STATE.clients.findIndex((x) => x.id === m[1]);
      if (idx < 0) return send(res, 404, { error: 'not_found', message: `client ${m[1]} not found` });
      STATE.clients.splice(idx, 1);
      return send(res, 204, '');
    });
  }],

  ['GET', /^\/v1\/probes\/executions\/?(\?.*)?$/, (req, res) => {
    const q = parseQuery(req.url);
    let items = STATE.probeExecutions;
    if (q.engagementId) items = items.filter((x) => x.engagementId === q.engagementId);
    return send(res, 200, page(items));
  }],
  ['POST', /^\/v1\/probes\/executions\/?$/, async (req, res) => {
    const body = await readJson(req);
    const v = validateBody(body, ['probeId', 'engagementId']);
    if (!v.ok) return send(res, 400, { error: 'invalid_body', message: 'probeId + engagementId required', missing: v.missing });
    return withMutation(() => {
      const t = NOW();
      const exec = {
        id: newId('px'), firmId: FIRM, engagementId: body.engagementId,
        probeId: body.probeId, status: 'queued',
        target: body.target, budget: body.budget,
        costUsd: 0, createdAt: t,
      };
      STATE.probeExecutions.push(exec);
      // Flip to success after 2s without running anything (mock only).
      setTimeout(() => {
        withMutation(() => {
          const cur = STATE.probeExecutions.find((x) => x.id === exec.id);
          if (!cur) return;
          cur.status = 'success';
          cur.finishedAt = NOW();
          cur.result = { probeId: cur.probeId, passed: true, severity: 'medium', evidence: ['synthetic'] };
          cur.costUsd = 0.42;
          emitEvent(cur.engagementId, 'probe.completed', { executionId: cur.id, probeId: cur.probeId });
        });
      }, 2000);
      emitEvent(exec.engagementId, 'probe.executed', { executionId: exec.id, probeId: exec.probeId });
      return send(res, 201, exec);
    });
  }],
  ['GET', /^\/v1\/probes\/?(\?.*)?$/, (req, res) => send(res, 200, page(STATE.probes))],
  ['GET', /^\/v1\/probes\/([^/?]+)\/?$/, (req, res, m) => {
    const p = STATE.probes.find((x) => x.id === m[1]);
    return p ? send(res, 200, p) : send(res, 404, { error: 'not_found', message: `probe ${m[1]} not found` });
  }],

  ['GET', /^\/v1\/traces\/?(\?.*)?$/, (req, res) => send(res, 200, page(STATE.traces))],
  ['POST', /^\/v1\/traces\/?$/, async (req, res) => {
    const ct = req.headers['content-type'] || '';
    const buf = await readBody(req);
    let filename = 'trace.bin';
    let size = buf.length;
    if (ct.startsWith('multipart/form-data')) {
      const parsed = parseMultipartFilename(buf, ct);
      if (parsed) { filename = parsed.filename; size = parsed.size; }
    } else if (ct.includes('application/json')) {
      try {
        const j = JSON.parse(buf.toString('utf8') || '{}');
        if (j.name) filename = j.name;
        if (typeof j.size === 'number') size = j.size;
      } catch {}
    }
    return withMutation(() => {
      const t = NOW();
      const trace = {
        id: newId('trc'), firmId: FIRM, name: filename,
        metadata: { sizeBytes: size, ingestedVia: ct.startsWith('multipart') ? 'multipart' : 'json', capturedAt: t },
        createdAt: t, updatedAt: t,
      };
      STATE.traces.push(trace);
      const engId = STATE.engagements[0]?.id;
      if (engId) emitEvent(engId, 'trace.ingested', { traceId: trace.id, name: filename, sizeBytes: size });
      return send(res, 201, trace);
    });
  }],
  ['GET', /^\/v1\/traces\/([^/?]+)\/?$/, (req, res, m) => {
    const t = STATE.traces.find((x) => x.id === m[1]);
    return t ? send(res, 200, t) : send(res, 404, { error: 'not_found', message: `trace ${m[1]} not found` });
  }],

  ['GET', /^\/v1\/library\/?(\?.*)?$/, (req, res) => {
    const q = parseQuery(req.url);
    let items = STATE.library;
    if (q.kind) items = items.filter((x) => x.kind === q.kind);
    if (q.q) {
      const needle = q.q.toLowerCase();
      items = items.filter((x) =>
        (x.title || '').toLowerCase().includes(needle) || (x.body || '').toLowerCase().includes(needle));
    }
    const offset = q.offset ? Number(q.offset) : 0;
    const limit = q.limit ? Math.max(1, Math.min(500, Number(q.limit))) : 50;
    items = items.slice(offset, offset + limit);
    return send(res, 200, page(items));
  }],

  ['GET', /^\/v1\/working-papers\/?(\?.*)?$/, (req, res) => {
    const q = parseQuery(req.url);
    let items = STATE.workingPapers;
    if (q.engagementId) items = items.filter((x) => x.engagementId === q.engagementId);
    return send(res, 200, page(items));
  }],
  ['POST', /^\/v1\/working-papers\/?$/, async (req, res) => {
    const body = await readJson(req);
    const v = validateBody(body, ['title', 'engagementId']);
    if (!v.ok) return send(res, 400, { error: 'invalid_body', message: 'title + engagementId required', missing: v.missing });
    return withMutation(() => {
      const t = NOW();
      const wp = {
        id: newId('wp'), firmId: FIRM, engagementId: body.engagementId,
        templateId: body.templateId, title: body.title,
        controlRef: body.controlRef ?? '', bodyMarkdown: body.bodyMarkdown ?? '',
        evidenceRefs: body.evidenceRefs ?? [],
        kind: body.kind ?? 'general', status: body.status ?? 'draft',
        version: 1, createdAt: t, updatedAt: t,
      };
      STATE.workingPapers.push(wp);
      emitEvent(wp.engagementId, 'working_paper.created', { id: wp.id, title: wp.title });
      return send(res, 201, wp);
    });
  }],
  ['PATCH', /^\/v1\/working-papers\/([^/?]+)\/?$/, async (req, res, m) => {
    const body = await readJson(req);
    return withMutation(() => {
      const idx = STATE.workingPapers.findIndex((x) => x.id === m[1]);
      if (idx < 0) return send(res, 404, { error: 'not_found', message: `working-paper ${m[1]} not found` });
      const cur = STATE.workingPapers[idx];
      const updated = { ...cur, ...body, id: cur.id, firmId: FIRM, version: cur.version + 1, updatedAt: NOW() };
      STATE.workingPapers[idx] = updated;
      emitEvent(updated.engagementId, 'working_paper.updated', { id: updated.id, version: updated.version });
      return send(res, 200, updated);
    });
  }],

  ['POST', /^\/v1\/reports\/draft\/?$/, async (req, res) => {
    const body = await readJson(req);
    const v = validateBody(body, ['engagementId']);
    if (!v.ok) return send(res, 400, { error: 'invalid_body', message: 'engagementId required', missing: v.missing });
    return withMutation(() => {
      const t = NOW();
      const draft = {
        engagementId: body.engagementId,
        draftId: newId('rep'),
        status: 'draft',
        generatedAt: t,
        qaChecklist: [
          { id: 'qa-001', label: 'Scope statement matches engagement letter', status: 'pending' },
          { id: 'qa-002', label: 'Every NC has documented evidence', status: 'pending' },
          { id: 'qa-003', label: 'Peer review signed off', status: 'pending' },
        ],
        coverageSummary: STATE.coverage[body.engagementId] ?? STATE.coverage['eng-001'],
        candidateFindings: STATE.candidateFindings[body.engagementId] ?? [],
      };
      emitEvent(body.engagementId, 'report.draft.generated', { draftId: draft.draftId });
      return send(res, 200, draft);
    });
  }],

  ['GET', /^\/v1\/peer-review\/?(\?.*)?$/, (req, res) => send(res, 200, page([]))],
  ['GET', /^\/v1\/qa-checklist\/?(\?.*)?$/, (req, res) => send(res, 200, page([]))],
  ['POST', /^\/v1\/identity\/logout\/?$/, (req, res) => send(res, 200, { ok: true })],
];

const args = new Set(process.argv.slice(2));
if (args.has('--reset')) {
  if (existsSync(STATE_FILE)) {
    rmSync(STATE_FILE, { force: true });
    console.log(`[mock] --reset: deleted ${STATE_FILE}`);
  } else {
    console.log('[mock] --reset: no state file present');
  }
}

loadState();

const server = createServer(async (req, res) => {
  const origin = req.headers.origin || 'http://localhost:3000';
  res.__origin = origin;
  if (req.method === 'OPTIONS') return send(res, 204, '', origin);

  reqCounter += 1;
  if (reqCounter % 50 === 0) console.log(`[mock] total requests ${reqCounter}`);

  for (const [method, regex, handler] of routes) {
    if (req.method !== method) continue;
    const m = req.url.match(regex);
    if (m) {
      console.log(`[mock] ${req.method} ${req.url} (origin=${origin})`);
      try {
        await handler(req, res, m);
      } catch (err) {
        if (err && err.status === 400) {
          send(res, 400, { error: 'invalid_body', message: err.message });
        } else {
          console.error(`[mock] handler error: ${err?.stack || err}`);
          if (!res.writableEnded) send(res, 500, { error: 'internal_error', message: String(err?.message || err) });
        }
      }
      return;
    }
  }
  console.log(`[mock] 404 ${req.method} ${req.url}`);
  return send(res, 404, { error: 'route_not_found', method: req.method, path: req.url }, origin);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[dev-mock-api] listening on http://localhost:${PORT}`);
  console.log(`[dev-mock-api] state file: ${STATE_FILE}`);
});
