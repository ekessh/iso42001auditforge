// SPDX-License-Identifier: BUSL-1.1

import { createHash } from 'node:crypto';
import {
  READINESS_DISCLAIMER,
  type ReportInput,
} from './report-domain.js';

const enc = new TextEncoder();

interface PdfObject { id: number; bytes: Uint8Array; }

class PdfBuilder {
  private readonly objects: PdfObject[] = [];
  private nextId = 1;
  alloc(): number { return this.nextId++; }
  add(id: number, bytes: Uint8Array): void { this.objects.push({ id, bytes }); }
  addText(id: number, text: string): void { this.objects.push({ id, bytes: enc.encode(text) }); }
  serialize(): Uint8Array {
    const offsets: number[] = [0];
    const parts: Uint8Array[] = [];
    let pos = 0;
    const header = enc.encode('%PDF-1.7\n%âãÏÓ\n');
    parts.push(header);
    pos += header.length;
    const sorted = [...this.objects].sort((a, b) => a.id - b.id);
    for (const o of sorted) {
      offsets[o.id] = pos;
      const head = enc.encode(`${o.id} 0 obj\n`);
      parts.push(head); pos += head.length;
      parts.push(o.bytes); pos += o.bytes.length;
      const tail = enc.encode('\nendobj\n');
      parts.push(tail); pos += tail.length;
    }
    const xrefPos = pos;
    let xref = `xref\n0 ${sorted.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= sorted.length; i++) {
      const off = (offsets[i] ?? 0).toString().padStart(10, '0');
      xref += `${off} 00000 n \n`;
    }
    parts.push(enc.encode(xref)); pos += xref.length;
    const trailer = `trailer\n<< /Size ${sorted.length + 1} /Root 1 0 R /Info 2 0 R /ID [<${docId(parts)}><${docId(parts)}>] >>\nstartxref\n${xrefPos}\n%%EOF`;
    parts.push(enc.encode(trailer));
    pos += trailer.length;
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const part of parts) { out.set(part, p); p += part.length; }
    return out;
  }
}

function docId(parts: readonly Uint8Array[]): string {
  const h = createHash('md5');
  for (const p of parts) h.update(Buffer.from(p));
  return h.digest('hex').toUpperCase();
}

function pdfStringEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function xmpEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface PdfBuildAttachment {
  readonly name: string;
  readonly relationship: 'Source' | 'Data' | 'Alternative' | 'Supplement' | 'Unspecified';
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly description?: string;
  readonly sha256: string;
}

export interface PdfBuildInput {
  readonly report: ReportInput;
  readonly attachments?: readonly PdfBuildAttachment[];
  readonly producer?: string;
}

function buildXmp(input: PdfBuildInput): string {
  const r = input.report;
  const title = r.kind === 'readiness' ? 'ISO 42001 Readiness Assessment' : 'ISO 42001 Audit Report';
  const producer = input.producer ?? 'AuditForge ReportEngine 0.1';
  return `<?xpacket begin="ï»¿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
     xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
     xmlns:xmp="http://ns.adobe.com/xap/1.0/"
     xmlns:af="urn:auditforge">
    <pdfaid:part>3</pdfaid:part>
    <pdfaid:conformance>B</pdfaid:conformance>
    <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmpEscape(title)}</rdf:li></rdf:Alt></dc:title>
    <dc:creator><rdf:Seq><rdf:li>AuditForge</rdf:li></rdf:Seq></dc:creator>
    <pdf:Producer>${xmpEscape(producer)}</pdf:Producer>
    <xmp:CreateDate>${xmpEscape(r.generatedAt)}</xmp:CreateDate>
    <af:reportId>${xmpEscape(r.reportId)}</af:reportId>
    <af:engagementId>${xmpEscape(r.engagementId)}</af:engagementId>
    <af:reportKind>${xmpEscape(r.kind)}</af:reportKind>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function plainTextLines(input: ReportInput): string[] {
  const lines: string[] = [];
  if (input.kind === 'readiness') {
    lines.push('ISO 42001 Readiness Assessment - NOT A CERTIFICATION AUDIT');
    lines.push(READINESS_DISCLAIMER);
    lines.push(`Readiness score: ${(input.readinessScore * 100).toFixed(1)}%`);
  } else if (input.kind === 'audit') {
    lines.push(`ISO 42001 Audit Report (${input.auditEventKind})`);
  } else {
    lines.push('ISO 42001 Annex A Report');
  }
  lines.push(`Engagement: ${input.engagementId}`);
  lines.push(`Client: ${input.clientLegalName}`);
  lines.push(`Scope: ${input.scopeStatement.slice(0, 200)}`);
  lines.push(`Methodology: ${input.methodologySummary.slice(0, 200)}`);
  lines.push(`Findings: ${input.findings.length}`);
  for (const s of input.signers) {
    lines.push(`Signer (${s.role}): ${s.name}`);
  }
  return lines;
}

function buildContentStream(lines: readonly string[]): Uint8Array {
  const cmds: string[] = [];
  cmds.push('BT', '/F1 11 Tf', '60 760 Td', '14 TL');
  for (const line of lines) {
    const safe = pdfStringEscape(line.length > 110 ? line.slice(0, 110) + '...' : line);
    cmds.push(`(${safe}) Tj T*`);
  }
  cmds.push('ET');
  return enc.encode(cmds.join('\n'));
}

export function buildPdf(input: PdfBuildInput): Uint8Array {
  const b = new PdfBuilder();
  const catalogId = b.alloc(); // 1
  const infoId = b.alloc(); // 2
  const pagesId = b.alloc(); // 3
  const pageId = b.alloc(); // 4
  const fontId = b.alloc(); // 5
  const contentId = b.alloc(); // 6
  const xmpId = b.alloc(); // 7
  const outputIntentId = b.alloc(); // 8

  // Attachments
  const attachments = input.attachments ?? [];
  const filespecIds: number[] = [];
  for (const _ of attachments) {
    void _;
    const efStreamId = b.alloc();
    const filespecId = b.alloc();
    filespecIds.push(filespecId);
    void efStreamId;
  }

  const xmpStream = buildXmp(input);
  b.addText(xmpId, `<< /Type /Metadata /Subtype /XML /Length ${xmpStream.length} >>\nstream\n${xmpStream}\nendstream`);

  const sRgbProfile = '<< /N 3 /Length 0 >>\nstream\n\nendstream';
  const outputIntentProfileId = b.alloc();
  b.addText(outputIntentProfileId, sRgbProfile);
  b.addText(
    outputIntentId,
    `[ << /Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier (sRGB IEC61966-2.1) /Info (sRGB IEC61966-2.1) /DestOutputProfile ${outputIntentProfileId} 0 R >> ]`,
  );

  let p = 0;
  const fileSpecsArrayParts: string[] = [];
  for (const att of attachments) {
    const efId = b.alloc();
    const efStream = att.bytes;
    const params = `/CheckSum <${att.sha256}> /Size ${efStream.length}`;
    const efObjBytes = concat(
      enc.encode(`<< /Type /EmbeddedFile /Subtype /${att.mimeType.replace('/', '#2F')} /Length ${efStream.length} /Params << ${params} >> >>\nstream\n`),
      efStream,
      enc.encode('\nendstream'),
    );
    b.add(efId, efObjBytes);
    const fsId = filespecIds[p++]!;
    const desc = pdfStringEscape(att.description ?? '');
    b.addText(
      fsId,
      `<< /Type /Filespec /F (${pdfStringEscape(att.name)}) /UF (${pdfStringEscape(att.name)}) /Desc (${desc}) /AFRelationship /${att.relationship} /EF << /F ${efId} 0 R /UF ${efId} 0 R >> >>`,
    );
    fileSpecsArrayParts.push(`(${pdfStringEscape(att.name)}) ${fsId} 0 R`);
  }

  const lines = plainTextLines(input.report);
  const content = buildContentStream(lines);
  b.add(
    contentId,
    concat(
      enc.encode(`<< /Length ${content.length} >>\nstream\n`),
      content,
      enc.encode('\nendstream'),
    ),
  );

  b.addText(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  const namesEntry = attachments.length > 0
    ? ` /Names << /EmbeddedFiles << /Names [ ${fileSpecsArrayParts.join(' ')} ] >> >> /AF [ ${filespecIds.map((i) => `${i} 0 R`).join(' ')} ]`
    : '';

  b.addText(
    catalogId,
    `<< /Type /Catalog /Pages ${pagesId} 0 R /Metadata ${xmpId} 0 R /OutputIntents ${outputIntentId} 0 R${namesEntry} >>`,
  );

  const r = input.report;
  const titleFor = r.kind === 'readiness' ? 'ISO 42001 Readiness Assessment' : 'ISO 42001 Audit Report';
  b.addText(
    infoId,
    `<< /Title (${pdfStringEscape(titleFor)}) /Author (AuditForge) /Producer (${pdfStringEscape(input.producer ?? 'AuditForge ReportEngine')}) /CreationDate (D:${nowPdfDate(r.generatedAt)}) >>`,
  );

  b.addText(pagesId, `<< /Type /Pages /Kids [ ${pageId} 0 R ] /Count 1 >>`);
  b.addText(
    pageId,
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
  );
  return b.serialize();
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of arrs) { out.set(a, p); p += a.length; }
  return out;
}

function nowPdfDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '20260101000000Z';
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
