// SPDX-License-Identifier: BUSL-1.1
// Enforce SPDX-License-Identifier: BUSL-1.1 on every source file.
//
// Run: node scripts/license-check.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const EXPECTED = 'SPDX-License-Identifier: BUSL-1.1';

const CHECK_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
  '.css', '.scss',
  '.sql',
  '.py',
  '.go',
  '.rs',
  '.sh', '.bash',
]);

const EXEMPT_PATHS = ['node_modules', 'dist', 'build', '.next', 'coverage', '.turbo', '.git'];
const EXEMPT_FILE_PATTERNS = [
  /next-env\.d\.ts$/,
  /\.d\.ts$/,
];

const repoRoot = process.cwd();
const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);

const errors = [];
for (const file of tracked) {
  if (EXEMPT_PATHS.some((p) => file.split('/').includes(p))) continue;
  if (EXEMPT_FILE_PATTERNS.some((rx) => rx.test(file))) continue;
  const ext = '.' + file.split('.').pop();
  if (!CHECK_EXTS.has(ext)) continue;

  let body;
  try {
    body = readFileSync(join(repoRoot, file), 'utf8');
  } catch {
    continue;
  }

  const head = body.split('\n').slice(0, 25).join('\n');
  if (!head.includes(EXPECTED)) {
    errors.push(`${file}: missing "${EXPECTED}"`);
  }
}

if (errors.length > 0) {
  console.error('License check failed:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

console.log('License check passed.');
