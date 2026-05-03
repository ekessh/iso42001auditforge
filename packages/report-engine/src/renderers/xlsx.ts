// SPDX-License-Identifier: BUSL-1.1
//
// XLSX renderer.
//
// Production wiring uses `exceljs`. Hosts inject an `XlsxWriter`. The engine
// supplies a deterministic reference encoder for tests.

import type { RenderArtifact } from '../domain.js';

export interface XlsxSheet {
  readonly name: string;
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface XlsxWriter {
  write(sheets: readonly XlsxSheet[]): Promise<Uint8Array>;
}

/**
 * Convert a `RenderArtifact` (typically a Findings Summary) into a list of
 * XLSX sheets. Tables become sheets; headings become sheet names. Other
 * blocks are emitted into a "Narrative" sheet so nothing is silently lost.
 */
export function artifactToSheets(artifact: RenderArtifact): XlsxSheet[] {
  const sheets: XlsxSheet[] = [];
  let currentHeading = 'Report';
  const narrative: string[][] = [];
  for (const block of artifact.blocks) {
    if (block.kind === 'heading' && block.level <= 2) {
      currentHeading = block.text;
      continue;
    }
    if (block.kind === 'table') {
      sheets.push({
        name: sanitizeSheetName(currentHeading),
        header: [...block.header],
        rows: block.rows.map((r) => [...r]),
      });
      continue;
    }
    if (block.kind === 'list') {
      sheets.push({
        name: sanitizeSheetName(`${currentHeading} List`),
        header: ['Item'],
        rows: block.items.map((it) => [it]),
      });
      continue;
    }
    if (block.kind === 'paragraph') {
      const text = block.inlines.map((i) => i.text).join('');
      if (text.trim().length > 0) narrative.push([currentHeading, text]);
    }
  }
  if (narrative.length > 0) {
    sheets.push({ name: 'Narrative', header: ['Section', 'Text'], rows: narrative });
  }
  return sheets;
}

function sanitizeSheetName(s: string): string {
  // Excel limits sheet names to 31 chars and forbids `\ / ? * [ ]`.
  return s.replace(/[\\/?*[\]]/g, '_').slice(0, 31) || 'Sheet';
}

export async function renderXlsx(
  artifact: RenderArtifact,
  writer: XlsxWriter,
): Promise<Uint8Array> {
  return writer.write(artifactToSheets(artifact));
}

export function encodeReferenceXlsx(sheets: readonly XlsxSheet[]): Uint8Array {
  const lines: string[] = ['XLSX/REF/v1'];
  for (const s of sheets) {
    lines.push(`#${s.name}`);
    lines.push(`H:${s.header.join('||')}`);
    for (const row of s.rows) lines.push(`R:${row.join('||')}`);
  }
  return new TextEncoder().encode(lines.join('\n'));
}

export const referenceXlsxWriter: XlsxWriter = {
  async write(sheets) {
    return encodeReferenceXlsx(sheets);
  },
};
