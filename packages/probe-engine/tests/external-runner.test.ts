// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import {
  ExternalAuditEvidenceRunner,
  ExternalAuditEvidenceRunnerError,
} from '../src/external-runner.js';

interface FakeRequest {
  url: string;
  method: string;
  body?: unknown;
}

function makeFetch(handler: (req: FakeRequest) => Response | Promise<Response>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    return handler({ url, method, body });
  }) as unknown as typeof fetch;
}

describe('ExternalAuditEvidenceRunner', () => {
  it('starts a run and returns the run id', async () => {
    const observed: FakeRequest[] = [];
    const runner = new ExternalAuditEvidenceRunner({
      baseUrl: 'http://sidecar.test',
      fetchImpl: makeFetch((req) => {
        observed.push(req);
        return new Response(JSON.stringify({ run_id: 'run-1' }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        });
      }),
    });

    const id = await runner.start({
      checkId: 'AC-01',
      target: { kind: 'http', endpoint: 'https://audit.test/echo' },
      budget: { max_seconds: 30, max_calls: 10, max_tokens: 1000, max_usd: 1 },
      engagementContextJwt: 'jwt-blob',
    });

    expect(id).toBe('run-1');
    expect(observed[0].url).toBe('http://sidecar.test/checks/run');
    expect(observed[0].method).toBe('POST');
    expect((observed[0].body as { check_id: string }).check_id).toBe('AC-01');
    expect((observed[0].body as { engagement_context: string }).engagement_context).toBe('jwt-blob');
  });

  it('parses status into the typed envelope', async () => {
    const runner = new ExternalAuditEvidenceRunner({
      baseUrl: 'http://sidecar.test',
      fetchImpl: makeFetch(() =>
        new Response(
          JSON.stringify({
            run_id: 'run-1',
            check_id: 'AC-01',
            state: 'complete',
            started_at: '2026-05-10T00:00:00.000Z',
            updated_at: '2026-05-10T00:00:01.000Z',
            metrics: { calls: 1, tokens: 0, usd: 0, wall_seconds: 0.05 },
            partial_findings: [],
            result: {
              run_id: 'run-1',
              check_id: 'AC-01',
              status: 'pass',
              severity: 'info',
              findings: [],
              metrics: { calls: 1, tokens: 0, usd: 0, wall_seconds: 0.05 },
              evidence_artifacts: [],
              timestamp_iso: '2026-05-10T00:00:01.000Z',
              terminated_by_budget: false,
              signature: 'sig-b64',
              signature_algorithm: 'Ed25519',
              signature_signer_id: 'audit-evidence-runner',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    });

    const status = await runner.status('run-1');
    expect(status.state).toBe('complete');
    expect(status.result?.status).toBe('pass');
    expect(status.result?.signature).toBe('sig-b64');
  });

  it('throws ExternalAuditEvidenceRunnerError on non-2xx', async () => {
    const runner = new ExternalAuditEvidenceRunner({
      baseUrl: 'http://sidecar.test',
      fetchImpl: makeFetch(() =>
        new Response(JSON.stringify({ detail: 'unknown check' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    });
    await expect(
      runner.start({
        checkId: 'AC-999',
        target: { kind: 'http', endpoint: 'https://audit.test/echo' },
        budget: { max_seconds: 30, max_calls: 10, max_tokens: 1000, max_usd: 1 },
        engagementContextJwt: 'jwt',
      }),
    ).rejects.toBeInstanceOf(ExternalAuditEvidenceRunnerError);
  });

  it('lists the catalogue with parsed entries', async () => {
    const runner = new ExternalAuditEvidenceRunner({
      baseUrl: 'http://sidecar.test',
      fetchImpl: makeFetch(() =>
        new Response(
          JSON.stringify([
            {
              id: 'AC-01',
              category: 'AC',
              family: 'authn',
              severity: 'high',
              title: 'Authorization-Required',
              description: 'desc',
              inputs_schema: { type: 'object' },
              outputs_schema: { type: 'object' },
              iso42001_clauses: ['8.3'],
              annex_a: ['A.7.4'],
              external_refs: [],
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    });
    const entries = await runner.catalogue();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('AC-01');
    expect(entries[0].category).toBe('AC');
  });

  it('parses an SSE stream into events', async () => {
    const sse =
      'event: state\ndata: {"state":"running"}\n\nevent: result\ndata: {"status":"pass"}\n\nevent: done\ndata: {}\n\n';
    const runner = new ExternalAuditEvidenceRunner({
      baseUrl: 'http://sidecar.test',
      fetchImpl: makeFetch(
        () =>
          new Response(sse, {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          }),
      ),
    });
    const events: { event: string; data: unknown }[] = [];
    for await (const e of runner.stream('run-1')) events.push(e);
    expect(events.map((e) => e.event)).toEqual(['state', 'result', 'done']);
  });

  it('cancels a run via POST /checks/cancel/:runId', async () => {
    const observed: FakeRequest[] = [];
    const runner = new ExternalAuditEvidenceRunner({
      baseUrl: 'http://sidecar.test',
      fetchImpl: makeFetch((req) => {
        observed.push(req);
        return new Response(JSON.stringify({ cancelled: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    });
    await runner.cancel('run-1');
    expect(observed[0].url).toBe('http://sidecar.test/checks/cancel/run-1');
    expect(observed[0].method).toBe('POST');
  });

  it('reports healthz', async () => {
    const runner = new ExternalAuditEvidenceRunner({
      baseUrl: 'http://sidecar.test',
      fetchImpl: makeFetch(
        () =>
          new Response(JSON.stringify({ status: 'ok', checks_registered: 15 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    });
    const h = await runner.healthz();
    expect(h.status).toBe('ok');
    expect(h.checks_registered).toBe(15);
  });
});
