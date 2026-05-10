// SPDX-License-Identifier: BUSL-1.1
//
// Barrel re-export for every Drizzle schema module in this directory.
// Drizzle Kit reads this single entry point (see ../../drizzle.config.ts).
// Adding a new table => add the file here.

export * from './_shared.js';
export * from './firms.js';
export * from './auditors.js';
export * from './catalogues.js';
export * from './engagements.js';
export * from './ai_systems.js';
export * from './working_papers.js';
export * from './evidence.js';
export * from './samples.js';
export * from './interviews.js';
export * from './probes.js';
export * from './findings.js';
export * from './reports.js';
export * from './ledger.js';
export * from './billing.js';
export * from './surveillance.js';
export * from './claims.js';
export * from './soa.js';
export * from './webauthn-credentials.js';
export * from './catalogue_embeddings.js';
