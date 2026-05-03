// SPDX-License-Identifier: BUSL-1.1
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WpTemplateSchema,
  type WpTemplate,
  type WpTemplateInput,
} from '../domain.js';

/**
 * Resolve the on-disk templates directory. Works under both ts-node and after
 * `tsc` build because we walk up to the package root and look for the sibling
 * `templates/` folder.
 */
function templatesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/templates/index.ts -> packages/working-papers/templates
  // dist/templates/index.js -> packages/working-papers/templates
  return resolve(here, '..', '..', 'templates');
}

const TEMPLATE_SUBDIRS = ['clauses', 'annex-a', 'ai-systems'] as const;

/**
 * Load all bundled templates from disk, validate each, and return the parsed
 * list. The function is safe to call on every server boot.
 */
export async function loadBundledTemplates(): Promise<WpTemplate[]> {
  const root = templatesDir();
  const all: WpTemplate[] = [];
  for (const sub of TEMPLATE_SUBDIRS) {
    const dir = join(root, sub);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const full = join(dir, entry);
      const raw = await readFile(full, 'utf8');
      const parsed = WpTemplateSchema.parse(JSON.parse(raw) as WpTemplateInput);
      all.push(parsed);
    }
  }
  return all;
}

export { templatesDir };
