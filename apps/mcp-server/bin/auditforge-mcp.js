#!/usr/bin/env node
// SPDX-License-Identifier: BUSL-1.1
/**
 * AuditForge MCP server CLI entrypoint.
 *
 * Phase 14 scaffold. Concrete HTTP/stdio transport wiring lands in Phase 15.
 * This shim validates env, prints the tool list, and exits — enough for
 * `pnpm --filter @auditforge/mcp-server start` to fail loudly when the API
 * token is missing.
 */
'use strict';

(async () => {
  const token = process.env.AUDITFORGE_API_TOKEN;
  if (!token) {
    process.stderr.write(
      'auditforge-mcp: AUDITFORGE_API_TOKEN is required (env var). Aborting.\n',
    );
    process.exit(2);
  }

  let mod;
  try {
    mod = await import('../dist/index.js');
  } catch (err) {
    process.stderr.write(
      `auditforge-mcp: build artefact not found at ../dist/index.js. Run \`pnpm --filter @auditforge/mcp-server build\` first.\n${err && err.message ? err.message + '\n' : ''}`,
    );
    process.exit(1);
  }

  const tools = (mod.ALL_TOOLS || []).map((t) => t.definition.name).sort();
  process.stdout.write(
    JSON.stringify(
      {
        server: '@auditforge/mcp-server',
        version: '0.0.1',
        toolCount: tools.length,
        tools,
        note: 'transport wiring lands in Phase 15',
      },
      null,
      2,
    ) + '\n',
  );
})();
