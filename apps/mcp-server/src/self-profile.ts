// SPDX-License-Identifier: BUSL-1.1
/**
 * AuditForge profiles itself in its own AI System Inventory — CLAUDE.md hard
 * rule. This module is the canonical source for `aiSystemInventory.profile`
 * tool output. Bumping the AuditForge release pulls the package version
 * forward; everything else is a static description of capabilities,
 * limitations, and governance posture.
 */

export interface SelfProfile {
  readonly modelName: 'auditforge-mcp';
  readonly displayName: string;
  readonly version: string;
  readonly purpose: string;
  readonly capabilities: readonly string[];
  readonly toolsExposed: readonly string[];
  readonly modelsUsedDownstream: readonly string[];
  readonly trainingDataSummary: string;
  readonly knownBiases: readonly string[];
  readonly limitations: readonly string[];
  readonly auditRetention: string;
  readonly outOfScopeUse: readonly string[];
  readonly dataAccess: {
    readonly scope: 'per-engagement';
    readonly pii: boolean;
    readonly cloudEgress: boolean;
  };
  readonly governance: {
    readonly standard: 'ISO/IEC 42001';
    readonly auditTrail: 'ed25519-signed-receipts';
    readonly confirmationRequired: readonly string[];
  };
}

export interface SelfProfileOpts {
  readonly version: string;
  readonly toolsExposed: readonly string[];
}

const PURPOSE =
  'ISO/IEC 42001 conformity audit assistance — read-only views over auditor-owned ' +
  'engagement data plus curated framework catalogue search. Exposed via MCP to ' +
  'auditor-side AI clients (e.g. Claude Desktop, Cursor) so the auditor can compose ' +
  'work-product across tools while the audit ledger captures every interaction.';

const CAPABILITIES: readonly string[] = [
  'List/get engagements scoped by membership and firm tenancy',
  'List formal findings (candidate findings never leave the engagement boundary)',
  'Per-clause coverage snapshot for an engagement',
  'Hybrid search across the question library and ISO 42001 / Annex A clause catalogues',
  'Read-only access to working papers (no write surface exposed via MCP)',
  'List/publish reports — publish requires a one-time confirmation token + Ed25519 receipt',
  'Look up ISO 42001 clause text, requirements, and common evidence types',
  'Query anonymized per-firm cross-engagement memory (Phase 15)',
  'Export anonymized cross-engagement memory snapshot (auditor-only)',
  'Self-profile via aiSystemInventory.profile (this entry)',
];

const MODELS_USED_DOWNSTREAM: readonly string[] = [
  'tier router: small/medium/large/reasoning',
  'local default: Ollama / vLLM / llama.cpp (no auditee data leaves the firm)',
  'cloud opt-in (per engagement, written auditee consent): Anthropic, OpenAI',
  'air-gap mode disables cloud at the provider layer',
];

const TRAINING_DATA_SUMMARY =
  'AuditForge itself is not trained — it is a rules-based and retrieval-augmented ' +
  'composition over the LLM provider abstraction. Engine outputs are always drafts; ' +
  'auditor confirmation is the only state-transition trigger. Question library content ' +
  'is curated by senior lead auditors and version-pinned; no auditee data is used to ' +
  'train any model.';

const KNOWN_BIASES: readonly string[] = [
  'Inherits the underlying LLM provider biases for any tool that calls a model (only ' +
    'follow-up question drafting, NC drafting, and engagement summarisation in this server).',
  'Mitigation: prompt-template hashing pins the exact prompt version; full LLM invocation ' +
    'is logged (provider, model, hash, tokens, latency, cost, decision) so peer reviewers ' +
    'can audit drift.',
  'Mitigation: re-ranker outputs only clause IDs from the catalogue (CI probe ' +
    'P-AF-CLAUSE-01); the model can never invent a clause reference.',
  'Library is firm-curated; coverage of edge-case AI systems may lag the catalogue.',
];

const LIMITATIONS: readonly string[] = [
  'Cannot promote candidate findings to formal findings (auditor-only via the web UI).',
  'Cannot edit working papers via MCP (read-only by design — auditor confirmation flow ' +
    'lives in the desktop / web UI).',
  'Cannot bypass auditor confirmation; report.publish requires a one-time signed ' +
    'confirmation token minted in the UI.',
  'Cannot leak data across engagements; cross-engagement memory is anonymized at ' +
    'extraction time and tenant-scoped per firm.',
  'Cannot conclude conformity. The engine is a backseat navigator; only the auditor ' +
    'concludes in the signed report.',
  'Provider switching does not invalidate prior auditor decisions (decisions are model-' +
    'independent at the audit-record level).',
];

const OUT_OF_SCOPE_USE: readonly string[] = [
  'Never used for offensive testing of auditee systems — probe execution lives in the ' +
    'separate probe-engine and requires explicit per-engagement scope-of-attack consent.',
  'Never auditee-facing without auditor confirmation — auditees go through the separate ' +
    'Auditee Portal, which has its own auth and disclosure boundary.',
  'Never used to make conformity decisions; ISO 17021-1 requires a competent human auditor.',
];

const AUDIT_RETENTION =
  'Hash-chained Ed25519-signed audit ledger. Every MCP tool call emits a tool-event ' +
  'record with paramsHash, verdict, error code, and latency. Mutating tools ' +
  '(report.publish, memory.export) additionally produce an Ed25519-signed receipt ' +
  'returned to the caller. The ledger is append-only and verifiable end-to-end.';

export function buildSelfProfile(opts: SelfProfileOpts): SelfProfile {
  return {
    modelName: 'auditforge-mcp',
    displayName: 'AuditForge MCP Server',
    version: opts.version,
    purpose: PURPOSE,
    capabilities: CAPABILITIES,
    toolsExposed: [...opts.toolsExposed],
    modelsUsedDownstream: MODELS_USED_DOWNSTREAM,
    trainingDataSummary: TRAINING_DATA_SUMMARY,
    knownBiases: KNOWN_BIASES,
    limitations: LIMITATIONS,
    auditRetention: AUDIT_RETENTION,
    outOfScopeUse: OUT_OF_SCOPE_USE,
    dataAccess: {
      scope: 'per-engagement',
      pii: true,
      cloudEgress: false,
    },
    governance: {
      standard: 'ISO/IEC 42001',
      auditTrail: 'ed25519-signed-receipts',
      confirmationRequired: ['report.publish', 'memory.export'],
    },
  };
}
