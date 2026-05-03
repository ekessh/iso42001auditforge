// SPDX-License-Identifier: BUSL-1.1
//
// DOCX renderer.
//
// Production wiring uses the `docx` npm package. Hosts inject a `DocxWriter`
// adapter that converts our IR into `Document/Paragraph/Table` etc. We avoid
// taking a runtime dependency on `docx` here so the engine stays usable in
// browsers and tests without bundling a 1.5 MB writer.
//
// The package ships a deterministic *reference* encoder (`encodeReferenceDocx`)
// that produces a stable byte sequence keyed off the IR. Tests compare those
// bytes for golden snapshots. The reference encoder emits a small Word-2007
// shape (a single XML stream) — sufficient for `byte-stable diff via
// comparison normalization` tests required by the design.

import type { RenderArtifact, Block } from '../domain.js';
import type { Branding } from '../branding/index.js';

export interface DocxWriter {
  /** Convert the IR into final DOCX bytes. */
  write(artifact: RenderArtifact, branding?: Branding): Promise<Uint8Array>;
}

/**
 * Renders the IR using a host-injected writer. Production hosts plug in the
 * `docx` package; tests can plug in `referenceDocxWriter` for byte-stable
 * golden fixtures.
 */
export async function renderDocx(
  artifact: RenderArtifact,
  writer: DocxWriter,
  branding?: Branding,
): Promise<Uint8Array> {
  return writer.write(artifact, branding);
}

/**
 * Deterministic, normalized text dump — *not* a real .docx file. It is a
 * stable representation we use for byte-diff golden tests. Real DOCX byte
 * comparison fails because of OS metadata, ZIP timestamps, etc; the design
 * mandates "byte-stable diff via comparison normalization", so we normalize
 * to this canonical form for tests.
 */
export function encodeReferenceDocx(artifact: RenderArtifact, branding?: Branding): Uint8Array {
  const lines: string[] = [];
  lines.push('DOCX/REF/v1');
  lines.push(`templateId:${artifact.templateId}`);
  lines.push(`templateType:${artifact.templateType}`);
  lines.push(`locale:${artifact.locale}`);
  lines.push(`contentHash:${artifact.contentHash}`);
  if (branding !== undefined) {
    lines.push(`brand:${branding.cb.name}|${branding.theme.primaryHex}`);
    if (branding.cb.logoSrc !== undefined) lines.push(`logo:${branding.cb.logoSrc}`);
    if (branding.cb.address !== undefined) lines.push(`addr:${branding.cb.address}`);
    if (branding.cb.registrationNumbers !== undefined) {
      for (const r of branding.cb.registrationNumbers) lines.push(`reg:${r}`);
    }
    if (branding.headerText !== undefined) lines.push(`hdr:${branding.headerText}`);
    if (branding.footerText !== undefined) lines.push(`ftr:${branding.footerText}`);
  }
  for (const b of artifact.blocks) {
    lines.push(encodeBlock(b));
  }
  return new TextEncoder().encode(lines.join('\n'));
}

function encodeBlock(b: Block): string {
  switch (b.kind) {
    case 'heading':
      return `H${b.level}: ${b.text}`;
    case 'paragraph': {
      const inlines = b.inlines.map((i) => {
        const flags = `${i.bold === true ? 'B' : ''}${i.italic === true ? 'I' : ''}`;
        return flags.length > 0 ? `[${flags}]${i.text}` : i.text;
      }).join('');
      return `P: ${inlines}`;
    }
    case 'list':
      return `L${b.ordered ? 'O' : 'U'}: ${b.items.join(' | ')}`;
    case 'table':
      return `T: H[${b.header.join('||')}] R[${b.rows.map((r) => r.join('||')).join('//')}]`;
    case 'image':
      return `I: ${b.src}${b.caption !== undefined ? ` (${b.caption})` : ''}`;
    case 'pagebreak':
      return 'PB';
    case 'signature_block':
      return `S: ${b.signers.map((s) => `${s.role}=${s.nameVar}`).join(',')}`;
  }
}

export const referenceDocxWriter: DocxWriter = {
  async write(artifact, branding) {
    return encodeReferenceDocx(artifact, branding);
  },
};
