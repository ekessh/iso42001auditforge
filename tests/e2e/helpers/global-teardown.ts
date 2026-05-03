// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/** Global teardown — optionally wipes test data. Skipped in CI to preserve artifacts. */
export default async function globalTeardown(): Promise<void> {
  if (process.env["E2E_SKIP_TEARDOWN"]) return;
  // Intentionally light: test data is scoped to test-tenant IDs
  // Full wipe happens via db:seed:reset target in CI pipeline
  console.log("[e2e] global teardown complete");
}
