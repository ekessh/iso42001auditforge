// SPDX-License-Identifier: BUSL-1.1

import { writeZip } from './zip.js';
import {
  READINESS_DISCLAIMER,
  readinessOverallScore,
  type ReportInput,
  type ReportClause,
  type ReportFinding,
} from './report-domain.js';

const enc = new TextEncoder();

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function p(text: string, opts: { bold?: boolean; size?: number; heading?: 1 | 2 | 3 } = {}): string {
  const sizeHalfPt = opts.size !== undefined ? opts.size * 2 : 22;
  const headingTag = opts.heading !== undefined ? `<w:pStyle w:val="Heading${opts.heading}"/>` : '';
  const boldTag = opts.bold === true ? '<w:b/>' : '';
  return `<w:p><w:pPr>${headingTag}</w:pPr><w:r><w:rPr>${boldTag}<w:sz w:val="${sizeHalfPt}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function table(rows: readonly (readonly string[])[]): string {
  const cellWidth = 2200;
  const tableRows: string[] = [];
  for (const row of rows) {
    const cells = row.map((c) => `<w:tc><w:tcPr><w:tcW w:w="${cellWidth}" w:type="dxa"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">${xmlEscape(c)}</w:t></w:r></w:p></w:tc>`).join('');
    tableRows.push(`<w:tr>${cells}</w:tr>`);
  }
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${tableRows.join('')}</w:tbl>`;
}

function pageBreak(): string {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function clauseRows(clauses: readonly ReportClause[]): string[][] {
  const rows: string[][] = [['Clause', 'Title', 'Status', 'Weight', 'Evidence', 'Rationale']];
  for (const c of clauses) {
    rows.push([c.ref, c.title, c.status, c.weight.toFixed(2), String(c.evidenceCount), c.rationale ?? '']);
  }
  return rows;
}

function findingRows(findings: readonly ReportFinding[]): string[][] {
  if (findings.length === 0) return [['Number', 'Kind', 'Clause', 'Title']];
  const rows: string[][] = [['Number', 'Kind', 'Clause', 'Title']];
  for (const f of findings) rows.push([f.number, f.kind, f.clauseRef, f.title]);
  return rows;
}

function buildBody(input: ReportInput): string {
  const isReadiness = input.kind === 'readiness';
  const titleMap = {
    audit: `ISO/IEC 42001 Audit Report (${input.kind === 'audit' ? input.auditEventKind : ''})`,
    annexA: 'ISO/IEC 42001 Annex A Report',
    readiness: 'ISO/IEC 42001 Readiness Assessment (NOT A CERTIFICATION AUDIT)',
  } as const;
  const parts: string[] = [];
  parts.push(p(titleMap[input.kind], { bold: true, size: 18, heading: 1 }));
  if (isReadiness) {
    parts.push(p(READINESS_DISCLAIMER, { bold: true, size: 11 }));
    parts.push(p(`Readiness score: ${(input.readinessScore * 100).toFixed(1)}%`, { bold: true }));
  }
  parts.push(p('1. Engagement', { bold: true, heading: 2 }));
  parts.push(p(`Client: ${input.clientLegalName}`));
  parts.push(p(`Engagement ID: ${input.engagementId}`));
  parts.push(p(`Generated at: ${input.generatedAt}`));
  parts.push(p('2. Scope', { bold: true, heading: 2 }));
  parts.push(p(input.scopeStatement));
  parts.push(p('3. Methodology', { bold: true, heading: 2 }));
  parts.push(p(input.methodologySummary));
  parts.push(p('4. Clause Matrix', { bold: true, heading: 2 }));
  parts.push(table(clauseRows(input.clauses)));
  parts.push(p('5. Findings', { bold: true, heading: 2 }));
  parts.push(table(findingRows(input.findings)));
  if (input.kind === 'audit') {
    parts.push(p('6. Conformity Summary', { bold: true, heading: 2 }));
    parts.push(p(input.conformitySummary));
  } else if (input.kind === 'annexA') {
    parts.push(p('6. Statement of Applicability', { bold: true, heading: 2 }));
    parts.push(p(`SoA reference: ${input.applicabilityStatementRef}`));
  } else {
    parts.push(p('6. CAPA Summary', { bold: true, heading: 2 }));
    parts.push(p(input.capaSummary));
    parts.push(p(`Computed overall readiness: ${(readinessOverallScore(input.clauses) * 100).toFixed(1)}%`));
    parts.push(p(READINESS_DISCLAIMER));
  }
  parts.push(pageBreak());
  parts.push(p('7. Signatures', { bold: true, heading: 2 }));
  for (const s of input.signers) {
    parts.push(p(`${s.role}: ${s.name}${s.credential !== undefined ? ` (${s.credential})` : ''}`));
  }
  return parts.join('');
}

function documentXml(input: ReportInput): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${buildBody(input)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`;

function coreXml(input: ReportInput): string {
  const title = input.kind === 'readiness' ? 'ISO 42001 Readiness Assessment' : 'ISO 42001 Audit Report';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xmlEscape(title)}</dc:title>
<dc:creator>AuditForge ISO 42001</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${xmlEscape(input.generatedAt)}</dcterms:created>
</cp:coreProperties>`;
}

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>AuditForge</Application>
</Properties>`;

export function buildDocx(input: ReportInput): Uint8Array {
  return writeZip([
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc.encode(ROOT_RELS) },
    { name: 'word/document.xml', data: enc.encode(documentXml(input)) },
    { name: 'word/_rels/document.xml.rels', data: enc.encode(DOC_RELS) },
    { name: 'word/styles.xml', data: enc.encode(STYLES) },
    { name: 'docProps/core.xml', data: enc.encode(coreXml(input)) },
    { name: 'docProps/app.xml', data: enc.encode(APP_XML) },
  ]);
}
