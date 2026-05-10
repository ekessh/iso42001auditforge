// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

import { authorizeTool, listKnownTools, TOOL_POLICIES } from '../src/rbac.js';
import type { Principal } from '../src/types.js';

const lead: Principal = {
  auditorId: 'a1',
  firmId: 'f1',
  roles: ['lead_auditor'],
  engagements: ['e1'],
  sub: 's', tokenId: 't',
};
const peer: Principal = {
  auditorId: 'a2',
  firmId: 'f1',
  roles: ['peer_reviewer'],
  engagements: ['e1'],
  sub: 's', tokenId: 't',
};
const auditee: Principal = {
  auditorId: 'a3',
  firmId: 'f1',
  roles: ['auditee'],
  engagements: ['e1'],
  sub: 's', tokenId: 't',
};

describe('rbac', () => {
  it('publishes the 16 tool policies', () => {
    const tools = listKnownTools().sort();
    expect(tools).toEqual([
      'aiSystemInventory.profile',
      'clause.lookup',
      'draft_followup_question',
      'get_candidate_findings',
      'get_coverage_state',
      'get_engagement',
      'library.search',
      'list_engagements',
      'list_findings',
      'memory.export',
      'memory.query',
      'report.list',
      'report.publish',
      'search_claims',
      'summarize_engagement',
      'working-paper.read',
    ]);
    expect(Object.keys(TOOL_POLICIES)).toHaveLength(16);
  });

  it('denies unknown tools fail-closed', () => {
    const r = authorizeTool('does_not_exist', lead, 'e1');
    expect(r.allowed).toBe(false);
    expect(r.errorCode).toBe('mcp.unknown_tool');
  });

  it('lead_auditor allowed for list_engagements', () => {
    const r = authorizeTool('list_engagements', lead, null);
    expect(r.allowed).toBe(true);
  });

  it('peer_reviewer denied for list_engagements (not in role list)', () => {
    const r = authorizeTool('list_engagements', peer, null);
    expect(r.allowed).toBe(false);
    expect(r.errorCode).toBe('mcp.rbac.forbidden');
  });

  it('peer_reviewer allowed for list_findings with membership', () => {
    const r = authorizeTool('list_findings', peer, 'e1');
    expect(r.allowed).toBe(true);
  });

  it('peer_reviewer denied for list_findings without engagement id', () => {
    const r = authorizeTool('list_findings', peer, null);
    expect(r.allowed).toBe(false);
    expect(r.errorCode).toBe('mcp.rbac.missing_engagement');
  });

  it('peer_reviewer denied when not provisioned against engagement', () => {
    const r = authorizeTool('list_findings', peer, 'e2');
    expect(r.allowed).toBe(false);
    expect(r.errorCode).toBe('mcp.rbac.cross_tenant');
  });

  it('lead_auditor only for get_candidate_findings', () => {
    expect(authorizeTool('get_candidate_findings', lead, 'e1').allowed).toBe(true);
    expect(authorizeTool('get_candidate_findings', peer, 'e1').allowed).toBe(false);
  });

  it('auditee role excluded from get_engagement', () => {
    const r = authorizeTool('get_engagement', auditee, 'e1');
    expect(r.allowed).toBe(false);
  });
});
