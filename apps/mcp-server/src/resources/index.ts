// SPDX-License-Identifier: BUSL-1.1
/**
 * MCP resources. URI scheme: `engagement://{id}/<aspect>`.
 *
 * Resources are read-only views over the same data port the tools use; the
 * dispatcher applies the same RBAC + membership checks before returning bytes.
 */

import type {
  AuditDataPort,
  EngagementId,
  Principal,
} from '../types.js';

export type ResourceAspect =
  | 'working-papers'
  | 'findings'
  | 'candidate-findings'
  | 'claims'
  | 'coverage';

export const RESOURCE_ASPECTS: readonly ResourceAspect[] = [
  'working-papers',
  'findings',
  'candidate-findings',
  'claims',
  'coverage',
];

const RESOURCE_RE = /^engagement:\/\/([A-Za-z0-9_\-]+)\/(working-papers|findings|candidate-findings|claims|coverage)$/;

export interface ParsedResourceUri {
  readonly engagementId: EngagementId;
  readonly aspect: ResourceAspect;
}

export function parseResourceUri(uri: string): ParsedResourceUri | null {
  const m = RESOURCE_RE.exec(uri);
  if (!m || !m[1] || !m[2]) return null;
  return { engagementId: m[1], aspect: m[2] as ResourceAspect };
}

export function buildResourceUri(engagementId: EngagementId, aspect: ResourceAspect): string {
  return `engagement://${engagementId}/${aspect}`;
}

/**
 * Aspect-to-policy mapping. Each resource aspect inherits the RBAC of its
 * corresponding tool so we have one matrix.
 */
export const RESOURCE_TOOL_FOR: Readonly<Record<ResourceAspect, string>> = Object.freeze({
  'working-papers': 'get_engagement', // anyone with engagement access
  findings: 'list_findings',
  'candidate-findings': 'get_candidate_findings',
  claims: 'search_claims',
  coverage: 'get_coverage_state',
});

export interface ResourceReadResult {
  readonly uri: string;
  readonly mimeType: 'application/json';
  readonly text: string;
}

export async function readResource(
  uri: string,
  principal: Principal,
  data: AuditDataPort,
): Promise<ResourceReadResult> {
  const parsed = parseResourceUri(uri);
  if (!parsed) {
    throw new Error(`malformed resource uri: ${uri}`);
  }
  const { engagementId, aspect } = parsed;
  let payload: unknown;
  switch (aspect) {
    case 'working-papers':
      payload = await data.listWorkingPapers(principal, engagementId);
      break;
    case 'findings':
      payload = await data.listFindings(principal, engagementId);
      break;
    case 'candidate-findings':
      payload = await data.getCandidateFindings(principal, engagementId);
      break;
    case 'claims':
      payload = await data.searchClaims(principal, engagementId, '*');
      break;
    case 'coverage':
      payload = await data.getCoverageState(principal, engagementId);
      break;
    default: {
      const exhaustive: never = aspect;
      throw new Error(`unhandled aspect: ${String(exhaustive)}`);
    }
  }
  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(payload),
  };
}
