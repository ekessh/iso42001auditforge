// SPDX-License-Identifier: BUSL-1.1
//
// PDF/A-3 renderer.
//
// Production wiring stacks `pdfme` (high-level layout) on top of `pdf-lib`
// (low-level mutation) and `pdfkit` (direct emission for the cover sheet).
// Hosts inject a `PdfWriter` and an `XmpEmbedder`. The host is responsible
// for fonts (PDF/A-3 requires fully-embedded fonts).
//
// This package implements:
// - The PDF/A-3 marker insertion (the `OutputIntents` + XMP `pdfaid:part=3`).
// - Embedding source data files (XLSX evidence) as PDF/A-3 attachments
//   via `pdf-lib`'s `EmbeddedFile` API — exposed here as `PdfAttachment`s.
// - A reference encoder used by golden tests; it produces a deterministic
//   ASCII envelope that contains the literal markers checked for by the
//   conformance test (e.g. `%PDF-1.7`, `pdfaid:part="3"`, `OutputIntents`,
//   `EmbeddedFile`).

import type { RenderArtifact } from '../domain.js';
import type { Branding } from '../branding/index.js';

export interface PdfAttachment {
  /** Filename inside the PDF/A-3 file specification. */
  readonly name: string;
  /** Relationship: `Source`, `Data`, `Alternative`, `Supplement`, etc. */
  readonly relationship: 'Source' | 'Data' | 'Alternative' | 'Supplement' | 'Unspecified';
  /** Raw bytes of the attached file (e.g., the XLSX evidence). */
  readonly bytes: Uint8Array;
  /** MIME type. */
  readonly mimeType: string;
  /** Optional description. */
  readonly description?: string;
  /** Required for PDF/A-3: SHA-256 of `bytes` (lowercase hex). */
  readonly sha256: string;
}

export interface PdfRenderInput {
  readonly artifact: RenderArtifact;
  readonly branding?: Branding;
  /** Additional XMP metadata fields (Title, Author, etc.). */
  readonly xmp?: {
    readonly title?: string;
    readonly author?: string;
    readonly subject?: string;
    readonly keywords?: readonly string[];
    readonly producer?: string;
    readonly creationDate?: string;
  };
  /** PDF/A-3 attachments (e.g., XLSX evidence). */
  readonly attachments?: readonly PdfAttachment[];
}

export interface PdfWriter {
  write(input: PdfRenderInput): Promise<Uint8Array>;
}

export async function renderPdf(input: PdfRenderInput, writer: PdfWriter): Promise<Uint8Array> {
  return writer.write(input);
}

/**
 * Deterministic reference encoder — *not* a real PDF, but it contains the
 * exact textual markers veraPDF would inspect for PDF/A-3 conformance:
 *
 * - `%PDF-1.7` header (PDF/A-3 supports 1.4–1.7)
 * - XMP packet with `pdfaid:part="3"` and `pdfaid:conformance="B"`
 * - `OutputIntents` array
 * - `EmbeddedFile` entries with the `AFRelationship` key per ISO 19005-3
 *
 * The PDF/A-3 conformance test asserts these markers; veraPDF rule
 * 6.6.1 ("File specification dictionaries must contain AFRelationship")
 * is the most stringent rule we surface here.
 */
export function encodeReferencePdf(input: PdfRenderInput): Uint8Array {
  const { artifact, attachments = [], xmp = {}, branding } = input;
  const lines: string[] = [];
  lines.push('%PDF-1.7');
  lines.push('%aforge-pdfa3-reference');
  lines.push('<< /Type /Catalog');
  lines.push('   /OutputIntents [<< /Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier (sRGB IEC61966-2.1) >>]');
  lines.push('   /Metadata <<XMP');
  lines.push('   <?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>');
  lines.push('   <x:xmpmeta xmlns:x="adobe:ns:meta/">');
  lines.push('     <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">');
  lines.push('       <rdf:Description rdf:about=""');
  lines.push('         xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"');
  lines.push('         xmlns:dc="http://purl.org/dc/elements/1.1/"');
  lines.push('         xmlns:pdf="http://ns.adobe.com/pdf/1.3/">');
  lines.push('         <pdfaid:part>3</pdfaid:part>');
  lines.push('         <pdfaid:conformance>B</pdfaid:conformance>');
  if (xmp.title !== undefined) lines.push(`         <dc:title>${escapeXml(xmp.title)}</dc:title>`);
  if (xmp.author !== undefined) lines.push(`         <dc:creator>${escapeXml(xmp.author)}</dc:creator>`);
  if (xmp.subject !== undefined) lines.push(`         <dc:description>${escapeXml(xmp.subject)}</dc:description>`);
  if (xmp.keywords !== undefined) lines.push(`         <pdf:Keywords>${escapeXml(xmp.keywords.join(', '))}</pdf:Keywords>`);
  if (xmp.producer !== undefined) lines.push(`         <pdf:Producer>${escapeXml(xmp.producer)}</pdf:Producer>`);
  if (xmp.creationDate !== undefined) lines.push(`         <xmp:CreateDate>${escapeXml(xmp.creationDate)}</xmp:CreateDate>`);
  lines.push(`         <af:templateId xmlns:af="urn:auditforge">${artifact.templateId}</af:templateId>`);
  lines.push(`         <af:contentHash xmlns:af="urn:auditforge">${artifact.contentHash}</af:contentHash>`);
  lines.push('       </rdf:Description>');
  lines.push('     </rdf:RDF>');
  lines.push('   </x:xmpmeta>');
  lines.push('   <?xpacket end="w"?>');
  lines.push('   XMP>>');
  lines.push('>>');
  if (branding !== undefined) {
    lines.push(`% branding: ${branding.cb.name} primary=${branding.theme.primaryHex}`);
  }
  for (const block of artifact.blocks) {
    lines.push(`%% block ${block.kind}`);
  }
  for (const a of attachments) {
    lines.push('<< /Type /Filespec');
    lines.push(`   /F (${a.name}) /UF (${a.name})`);
    lines.push(`   /AFRelationship /${a.relationship}`);
    lines.push(`   /Desc (${escapeStr(a.description ?? '')})`);
    lines.push('   /EF << /F << /Type /EmbeddedFile');
    lines.push(`         /Subtype /${a.mimeType.replace('/', '#2F')}`);
    lines.push(`         /Params << /CheckSum <${a.sha256}> /Size ${a.bytes.byteLength} >> >> >>`);
    lines.push('>>');
  }
  lines.push('%%EOF');
  return new TextEncoder().encode(lines.join('\n'));
}

function escapeStr(s: string): string {
  return s.replace(/[()\\]/g, (c) => `\\${c}`);
}
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const referencePdfWriter: PdfWriter = {
  async write(input) {
    return encodeReferencePdf(input);
  },
};

/**
 * Inspects a PDF byte buffer for the minimum PDF/A-3 markers required by
 * veraPDF rule families 6.1 (header), 6.2 (XMP `pdfaid:part`), 6.6 (file
 * spec `AFRelationship`). Hosts may layer veraPDF-CLI for full validation.
 */
export interface PdfA3Conformance {
  readonly hasHeader: boolean;
  readonly hasXmp: boolean;
  readonly partIs3: boolean;
  readonly hasOutputIntents: boolean;
  readonly attachmentsHaveAfRelationship: boolean;
  readonly conforms: boolean;
}

export function checkPdfA3Markers(bytes: Uint8Array): PdfA3Conformance {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const hasHeader = /^%PDF-1\.[4-7]/.test(text);
  const hasXmp = /<x:xmpmeta\s/.test(text);
  const partIs3 = /<pdfaid:part>\s*3\s*<\/pdfaid:part>/.test(text) || /pdfaid:part="3"/.test(text);
  const hasOutputIntents = /\/OutputIntents\b/.test(text);
  // If there are file specs, every one must have AFRelationship
  const fileSpecCount = (text.match(/\/Type\s*\/Filespec/g) ?? []).length;
  const afRelCount = (text.match(/\/AFRelationship/g) ?? []).length;
  const attachmentsHaveAfRelationship = fileSpecCount === 0 || fileSpecCount === afRelCount;
  return {
    hasHeader,
    hasXmp,
    partIs3,
    hasOutputIntents,
    attachmentsHaveAfRelationship,
    conforms:
      hasHeader && hasXmp && partIs3 && hasOutputIntents && attachmentsHaveAfRelationship,
  };
}
