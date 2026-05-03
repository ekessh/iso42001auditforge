// SPDX-License-Identifier: BUSL-1.1
import { beforeEach, describe, expect, it } from 'vitest';

import { bearer, buildFixture, type Fixture } from './helpers.js';
import { buildResourceUri, parseResourceUri } from '../src/resources/index.js';

let f: Fixture;
beforeEach(() => {
  f = buildFixture();
});

describe('resources', () => {
  it('parseResourceUri parses every supported aspect', () => {
    const uri = buildResourceUri('eng-1', 'coverage');
    expect(parseResourceUri(uri)).toEqual({ engagementId: 'eng-1', aspect: 'coverage' });
    expect(parseResourceUri('engagement://eng-1/working-papers')?.aspect).toBe('working-papers');
    expect(parseResourceUri('engagement://eng-1/findings')?.aspect).toBe('findings');
    expect(parseResourceUri('engagement://eng-1/candidate-findings')?.aspect).toBe('candidate-findings');
    expect(parseResourceUri('engagement://eng-1/claims')?.aspect).toBe('claims');
  });

  it('rejects bad URIs', () => {
    expect(parseResourceUri('http://example')).toBeNull();
    expect(parseResourceUri('engagement://eng-1/unknown')).toBeNull();
  });

  it('listResources advertises 5 templates', () => {
    const r = f.server.listResources();
    expect(r).toHaveLength(5);
    const names = r.map((x) => x.name).sort();
    expect(names).toEqual(['candidate-findings', 'claims', 'coverage', 'findings', 'working-papers']);
  });

  it('reads working-papers for member auditor', async () => {
    const r = await f.server.readResourceRequest({
      authorization: bearer(f.tokens.lead!),
      uri: 'engagement://eng-acme-001/working-papers',
    });
    expect(r.ok).toBe(true);
    const body = JSON.parse(r.content!.text) as Array<{ id: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]!.id).toBe('wp-001');
  });

  it('reads candidate-findings only for lead', async () => {
    const lead = await f.server.readResourceRequest({
      authorization: bearer(f.tokens.lead!),
      uri: 'engagement://eng-acme-001/candidate-findings',
    });
    expect(lead.ok).toBe(true);

    const peer = await f.server.readResourceRequest({
      authorization: bearer(f.tokens.peer!),
      uri: 'engagement://eng-acme-001/candidate-findings',
    });
    expect(peer.ok).toBe(false);
    expect(peer.error?.code).toBe('mcp.rbac.forbidden');
  });

  it('cross-tenant resource read denied + audited', async () => {
    const r = await f.server.readResourceRequest({
      authorization: bearer(f.tokens.foreign!),
      uri: 'engagement://eng-acme-001/findings',
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('mcp.rbac.cross_tenant');
    expect(f.ledger.events.at(-1)?.type).toBe('mcp.resource.read');
    expect(f.ledger.events.at(-1)?.verdict).toBe('denied');
  });

  it('rejects malformed resource URI with audit event', async () => {
    const r = await f.server.readResourceRequest({
      authorization: bearer(f.tokens.lead!),
      uri: 'not-a-uri',
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('mcp.bad_uri');
    expect(f.ledger.events).toHaveLength(1);
    expect(f.ledger.events[0]!.errorCode).toBe('mcp.bad_uri');
  });

  it('rejects missing authorization at resource layer', async () => {
    const r = await f.server.readResourceRequest({
      authorization: null,
      uri: 'engagement://eng-acme-001/findings',
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toMatch(/mcp\.auth\./);
    expect(f.ledger.events[0]!.type).toBe('mcp.auth.denied');
  });
});
