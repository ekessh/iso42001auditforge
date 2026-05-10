// SPDX-License-Identifier: BUSL-1.1
import type { McpToolDescriptor } from './descriptor.js';
import {
  AiSystemInventoryProfileInput,
  AiSystemInventoryProfileOutput,
  type AiSystemInventoryProfileInputT,
  type AiSystemInventoryProfileOutputT,
  LibrarySearchInput,
  LibrarySearchOutput,
  type LibrarySearchInputT,
  type LibrarySearchOutputT,
  ReportListInput,
  ReportListOutput,
  type ReportListInputT,
  type ReportListOutputT,
  ReportPublishInput,
  ReportPublishOutput,
  type ReportPublishInputT,
  type ReportPublishOutputT,
  WorkingPaperReadInput,
  WorkingPaperReadOutput,
  type WorkingPaperReadInputT,
  type WorkingPaperReadOutputT,
} from './schemas.js';

export const librarySearchDescriptor: McpToolDescriptor<LibrarySearchInputT, LibrarySearchOutputT> = {
  name: 'library.search',
  description:
    'Search the question library by free-text query, optionally filtered by clauseIds. Returns library question id, text, mapped clauses, and a relevance score. Engagement-agnostic; the library itself is global to a firm.',
  inputSchema: LibrarySearchInput,
  outputSchema: LibrarySearchOutput,
  requiresConfirmation: false,
  category: 'library',
};

export const workingPaperReadDescriptor: McpToolDescriptor<WorkingPaperReadInputT, WorkingPaperReadOutputT> = {
  name: 'working-paper.read',
  description:
    'Read a single working paper. Read-only. Write operations are intentionally NOT exposed via MCP — auditor confirmation flow lives in the web UI (Phase 15 + later).',
  inputSchema: WorkingPaperReadInput,
  outputSchema: WorkingPaperReadOutput,
  requiresConfirmation: false,
  category: 'working-paper',
};

export const reportListDescriptor: McpToolDescriptor<ReportListInputT, ReportListOutputT> = {
  name: 'report.list',
  description:
    'List reports (draft, final, readiness) for an engagement. Returns id, kind, status, and timestamps. Read-only.',
  inputSchema: ReportListInput,
  outputSchema: ReportListOutput,
  requiresConfirmation: false,
  category: 'report',
};

export const reportPublishDescriptor: McpToolDescriptor<ReportPublishInputT, ReportPublishOutputT> = {
  name: 'report.publish',
  description:
    'Publish a finalised report. Requires a valid confirmationToken minted via the web UI consent flow. The token is single-use and bound to the report id; without it, the call is rejected. Emits a signed Ed25519 receipt to the audit ledger.',
  inputSchema: ReportPublishInput,
  outputSchema: ReportPublishOutput,
  requiresConfirmation: true,
  category: 'report',
};

export const aiSystemInventoryProfileDescriptor: McpToolDescriptor<
  AiSystemInventoryProfileInputT,
  AiSystemInventoryProfileOutputT
> = {
  name: 'aiSystemInventory.profile',
  description:
    'Return the AuditForge MCP server\'s own AI System Inventory profile. Per ISO 42001 Annex A.6.2: an organisation deploying an AI system must maintain an inventory entry for each system, including its own internal AI tooling. AuditForge profiles itself.',
  inputSchema: AiSystemInventoryProfileInput,
  outputSchema: AiSystemInventoryProfileOutput,
  requiresConfirmation: false,
  category: 'self-profile',
};

export const SCAFFOLD_DESCRIPTORS = [
  librarySearchDescriptor,
  workingPaperReadDescriptor,
  reportListDescriptor,
  reportPublishDescriptor,
  aiSystemInventoryProfileDescriptor,
] as const;

export function descriptorByName(
  name: string,
): (typeof SCAFFOLD_DESCRIPTORS)[number] | null {
  for (const d of SCAFFOLD_DESCRIPTORS) {
    if (d.name === name) return d;
  }
  return null;
}
