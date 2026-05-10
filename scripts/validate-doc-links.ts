// SPDX-License-Identifier: BUSL-1.1
/**
 * Validates that all relative Markdown links in docs/ and README.md
 * resolve to existing files.
 *
 * Usage:
 *   npx tsx scripts/validate-doc-links.ts
 *
 * Exit code:
 *   0 — all links resolve
 *   1 — one or more broken links found
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Collect markdown files
// ---------------------------------------------------------------------------

function collectMarkdownFiles(dir: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Skip node_modules and .git
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      collectMarkdownFiles(full, results);
    } else if (extname(entry) === '.md') {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Extract relative links from markdown content
// ---------------------------------------------------------------------------

// Matches: [text](path) where path does NOT start with http/https/mailto/#
const LINK_RE = /\[([^\]]*)\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]*)?\)/g;

interface BrokenLink {
  file: string;
  line: number;
  link: string;
  resolved: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const docsDir = join(ROOT, 'docs');
  const rootReadme = join(ROOT, 'README.md');

  const markdownFiles = collectMarkdownFiles(docsDir);
  markdownFiles.push(rootReadme);

  const broken: BrokenLink[] = [];
  const checked = new Set<string>();

  for (const file of markdownFiles) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      let match: RegExpExecArray | null;
      LINK_RE.lastIndex = 0;
      while ((match = LINK_RE.exec(line)) !== null) {
        const rawLink = match[2].trim();
        const resolved = resolve(dirname(file), rawLink);
        const key = `${file}::${rawLink}`;
        if (checked.has(key)) continue;
        checked.add(key);

        if (!existsSync(resolved)) {
          broken.push({
            file: file.replace(ROOT + '/', '').replace(ROOT + '\\', ''),
            line: lineIdx + 1,
            link: rawLink,
            resolved: resolved.replace(ROOT + '/', '').replace(ROOT + '\\', ''),
          });
        }
      }
    }
  }

  if (broken.length === 0) {
    console.log(`\nAll links valid. Checked ${checked.size} links in ${markdownFiles.length} files.\n`);
    process.exit(0);
  } else {
    console.error(`\nBroken links found (${broken.length}):\n`);
    for (const b of broken) {
      console.error(`  ${b.file}:${b.line}`);
      console.error(`    link:     ${b.link}`);
      console.error(`    resolves: ${b.resolved}`);
      console.error('');
    }
    process.exit(1);
  }
}

main();
