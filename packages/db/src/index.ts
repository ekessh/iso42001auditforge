// SPDX-License-Identifier: BUSL-1.1
//
// Public entry point for @auditforge/db.
//
// Re-exports the Drizzle schema barrel so callers can import either
//   import { auditFirms } from '@auditforge/db';
// or
//   import { auditFirms } from '@auditforge/db/schema';
// and get the same object.

export * as schema from './schema/index.js';
export * from './schema/index.js';
