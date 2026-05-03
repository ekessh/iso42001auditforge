// SPDX-License-Identifier: BUSL-1.1
import { createHash } from 'node:crypto';
import { render } from '../substitution/index.js';
import type { Helper } from '../substitution/index.js';
import { validateVariables } from '../templates/loader.js';
import type { Block, Locale, RenderArtifact, ReportTemplate } from '../domain.js';

export interface BuildArtifactOptions {
  readonly template: ReportTemplate;
  readonly variables: Record<string, unknown>;
  readonly locale?: Locale;
  readonly helpers?: Readonly<Record<string, Helper>>;
  /**
   * Override the wall-clock time for deterministic output (used by golden
   * fixture tests). Default: `new Date().toISOString()`.
   */
  readonly now?: () => string;
}

/**
 * Parse the rendered Markdown-ish text emitted by the substitution engine
 * into the JSON-stable block structure that downstream renderers consume.
 *
 * We keep this parser minimal-but-real: heading levels, lists, tables, and
 * paragraphs. Everything else collapses into paragraph blocks with inline
 * runs. Renderers can ascend to richer markup as needed.
 */
function parseToBlocks(rendered: string): Block[] {
  const blocks: Block[] = [];
  const lines = rendered.split(/\r?\n/);
  let i = 0;
  const flushParagraph = (buf: string[]): void => {
    if (buf.length === 0) return;
    const text = buf.join(' ').trim();
    if (text.length === 0) {
      buf.length = 0;
      return;
    }
    blocks.push({ kind: 'paragraph', inlines: parseInlines(text) });
    buf.length = 0;
  };
  let paragraphBuf: string[] = [];
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim().length === 0) {
      flushParagraph(paragraphBuf);
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading !== null) {
      flushParagraph(paragraphBuf);
      blocks.push({
        kind: 'heading',
        level: heading[1]!.length,
        text: heading[2]!.trim(),
      });
      i++;
      continue;
    }
    if (line.startsWith('| ')) {
      flushParagraph(paragraphBuf);
      const tbl = collectTable(lines, i);
      blocks.push(tbl.block);
      i = tbl.nextIndex;
      continue;
    }
    const listMatch = /^([-*])\s+(.+)$/.exec(line);
    if (listMatch !== null) {
      flushParagraph(paragraphBuf);
      const list = collectList(lines, i, false);
      blocks.push(list.block);
      i = list.nextIndex;
      continue;
    }
    const olMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (olMatch !== null) {
      flushParagraph(paragraphBuf);
      const list = collectList(lines, i, true);
      blocks.push(list.block);
      i = list.nextIndex;
      continue;
    }
    paragraphBuf.push(line.trim());
    i++;
  }
  flushParagraph(paragraphBuf);
  return blocks;
}

function parseInlines(text: string): { text: string; bold?: boolean; italic?: boolean }[] {
  const out: { text: string; bold?: boolean; italic?: boolean }[] = [];
  let i = 0;
  let buf = '';
  while (i < text.length) {
    if (text.startsWith('**', i)) {
      if (buf.length > 0) {
        out.push({ text: buf });
        buf = '';
      }
      const end = text.indexOf('**', i + 2);
      if (end === -1) {
        buf += text.slice(i);
        break;
      }
      out.push({ text: text.slice(i + 2, end), bold: true });
      i = end + 2;
      continue;
    }
    if (text[i] === '_' && text[i + 1] !== undefined && text[i + 1] !== '_') {
      const end = text.indexOf('_', i + 1);
      if (end !== -1) {
        if (buf.length > 0) {
          out.push({ text: buf });
          buf = '';
        }
        out.push({ text: text.slice(i + 1, end), italic: true });
        i = end + 1;
        continue;
      }
    }
    buf += text[i] ?? '';
    i++;
  }
  if (buf.length > 0) out.push({ text: buf });
  if (out.length === 0) out.push({ text: '' });
  return out;
}

function collectTable(
  lines: readonly string[],
  start: number,
): { block: Block; nextIndex: number } {
  const rows: string[][] = [];
  let i = start;
  while (i < lines.length && (lines[i] ?? '').startsWith('|')) {
    const raw = (lines[i] ?? '').trim();
    const cells = raw
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    rows.push(cells);
    i++;
  }
  const header = rows[0] ?? [];
  // skip the separator row if present
  const startBody = rows.length > 1 && (rows[1] ?? []).every((c) => /^-+$/.test(c)) ? 2 : 1;
  const body = rows.slice(startBody);
  return {
    block: {
      kind: 'table',
      header: header.length === 0 ? ['_'] : header,
      rows: body,
    },
    nextIndex: i,
  };
}

function collectList(
  lines: readonly string[],
  start: number,
  ordered: boolean,
): { block: Block; nextIndex: number } {
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const m = ordered ? /^\d+\.\s+(.+)$/.exec(line) : /^[-*]\s+(.+)$/.exec(line);
    if (m === null) break;
    items.push(m[1]!.trim());
    i++;
  }
  if (items.length === 0) items.push(' ');
  return {
    block: { kind: 'list', ordered, items },
    nextIndex: i,
  };
}

function deterministicHash(template: ReportTemplate, vars: Record<string, unknown>): string {
  const stable = JSON.stringify({ id: template.id, version: template.version, vars: sortKeys(vars) });
  return createHash('sha256').update(stable).digest('hex');
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.keys(o)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys(o[k]);
        return acc;
      }, {});
  }
  return v;
}

/**
 * Build a deterministic render artifact (intermediate representation).
 * Renderers in `./docx`, `./pdf`, `./xlsx` consume this.
 */
export function buildArtifact(opts: BuildArtifactOptions): RenderArtifact {
  const validatedVars = validateVariables(opts.template, opts.variables);
  const locale = opts.locale ?? opts.template.defaultLocale;
  const blocks: Block[] = [];
  const helpers = opts.helpers;
  for (const section of opts.template.sections) {
    const renderedBody = render(section.body, {
      variables: validatedVars,
      locale,
      ...(helpers === undefined ? {} : { helpers }),
      escape: (s) => s, // we do not HTML-escape into the IR; renderers do format-specific escape
    });
    const sectionBlocks = parseToBlocks(renderedBody);
    blocks.push(...sectionBlocks);
  }
  const now = (opts.now ?? (() => new Date().toISOString()))();
  return {
    templateId: opts.template.id,
    templateType: opts.template.type,
    locale,
    generatedAt: now,
    contentHash: deterministicHash(opts.template, validatedVars),
    blocks,
  };
}
