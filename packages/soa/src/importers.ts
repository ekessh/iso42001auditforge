// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  SoaApplicabilitySchema,
  SoaImplementationStatusSchema,
  type SoaRecord,
  type ValidationIssue,
  type ValidationReport,
} from './domain.js';
import { assertSafeRelativePath } from './path-safety.js';

/**
 * Canonical column names recognised by every text-based importer
 * (case-insensitive, whitespace tolerant). Importers may map vendor
 * synonyms to these via the `columnAliases` option.
 */
export const CANONICAL_COLUMNS = {
  controlId: 'controlId',
  applicability: 'applicability',
  implementationStatus: 'implementationStatus',
  justification: 'justification',
  internalReference: 'internalReference',
  notes: 'notes',
} as const;

const DEFAULT_ALIASES: Record<string, keyof typeof CANONICAL_COLUMNS> = {
  controlid: 'controlId',
  control_id: 'controlId',
  control: 'controlId',
  controlref: 'controlId',
  reference: 'controlId',
  applicability: 'applicability',
  applicable: 'applicability',
  inscope: 'applicability',
  scope: 'applicability',
  status: 'implementationStatus',
  implementation: 'implementationStatus',
  implementationstatus: 'implementationStatus',
  implementation_status: 'implementationStatus',
  justification: 'justification',
  reason: 'justification',
  rationale: 'justification',
  internalref: 'internalReference',
  internal_reference: 'internalReference',
  reference_doc: 'internalReference',
  refdoc: 'internalReference',
  notes: 'notes',
  comment: 'notes',
  comments: 'notes',
};

const APPLICABILITY_SYNONYMS: Record<string, 'applicable' | 'not_applicable'> = {
  applicable: 'applicable',
  yes: 'applicable',
  y: 'applicable',
  true: 'applicable',
  '1': 'applicable',
  in_scope: 'applicable',
  in: 'applicable',
  'in scope': 'applicable',
  not_applicable: 'not_applicable',
  'not applicable': 'not_applicable',
  na: 'not_applicable',
  'n/a': 'not_applicable',
  no: 'not_applicable',
  n: 'not_applicable',
  false: 'not_applicable',
  '0': 'not_applicable',
  out_of_scope: 'not_applicable',
  'out of scope': 'not_applicable',
};

const IMPL_SYNONYMS: Record<string, z.infer<typeof SoaImplementationStatusSchema>> = {
  implemented: 'implemented',
  done: 'implemented',
  complete: 'implemented',
  'fully implemented': 'implemented',
  partially_implemented: 'partially_implemented',
  partial: 'partially_implemented',
  'partially implemented': 'partially_implemented',
  inprogress: 'partially_implemented',
  'in progress': 'partially_implemented',
  planned: 'planned',
  'to do': 'planned',
  todo: 'planned',
  not_implemented: 'not_implemented',
  'not implemented': 'not_implemented',
  none: 'not_implemented',
};

/** Pre-parsed grid: headers row + body rows (string cells, header order preserved). */
export interface ParsedGrid {
  headers: string[];
  rows: string[][];
}

export interface ImportOptions {
  /** Source file name; must be a safe, relative, sanitised path. */
  sourceFile: string;
  /** Engagement that owns these records. */
  engagementId: string;
  firmId: string;
  /** ISO timestamp factory; default is `new Date().toISOString()`. */
  now?: () => string;
  /** UUID factory used for `SoaRecord.id`. */
  newId: () => string;
  /** Optional vendor-specific column aliases on top of the defaults. */
  columnAliases?: Record<string, keyof typeof CANONICAL_COLUMNS>;
  /** When true, blank rows are silently dropped (otherwise reported as malformed). */
  skipBlankRows?: boolean;
}

export interface ImportResult {
  records: SoaRecord[];
  report: ValidationReport;
}

function normaliseHeaders(
  raw: string[],
  aliases: Record<string, keyof typeof CANONICAL_COLUMNS>,
): { map: Record<number, keyof typeof CANONICAL_COLUMNS>; unmapped: number[] } {
  const map: Record<number, keyof typeof CANONICAL_COLUMNS> = {};
  const unmapped: number[] = [];
  raw.forEach((header, idx) => {
    const key = header?.trim().toLowerCase().replace(/\s+/g, '_');
    if (key === undefined || key === '') {
      unmapped.push(idx);
      return;
    }
    const direct = (CANONICAL_COLUMNS as Record<string, string>)[header.trim()];
    if (direct !== undefined) {
      map[idx] = direct as keyof typeof CANONICAL_COLUMNS;
      return;
    }
    const alias = aliases[key] ?? aliases[key.replace(/_/g, '')];
    if (alias !== undefined) {
      map[idx] = alias;
      return;
    }
    unmapped.push(idx);
  });
  return { map, unmapped };
}

function coerceApplicability(raw: string): 'applicable' | 'not_applicable' | undefined {
  const v = raw.trim().toLowerCase();
  return APPLICABILITY_SYNONYMS[v];
}

function coerceImplementation(raw: string):
  | z.infer<typeof SoaImplementationStatusSchema>
  | undefined {
  const v = raw.trim().toLowerCase();
  return IMPL_SYNONYMS[v];
}

const CONTROL_ID_RE = /^A(?:\.\d+){1,4}$/;

function rowToRecord(
  row: string[],
  rowIndex: number,
  headerMap: Record<number, keyof typeof CANONICAL_COLUMNS>,
  opts: ImportOptions,
  issues: ValidationIssue[],
): SoaRecord | undefined {
  const fields: Partial<Record<keyof typeof CANONICAL_COLUMNS, string>> = {};
  for (const [colIdx, key] of Object.entries(headerMap)) {
    const cell = row[Number(colIdx)] ?? '';
    if (typeof cell !== 'string') {
      issues.push({
        row: rowIndex,
        field: key,
        code: 'malformed_row',
        message: 'cell value must be a string after pre-parse',
      });
      return undefined;
    }
    fields[key] = cell.trim();
  }

  const controlId = fields.controlId ?? '';
  if (controlId === '') {
    issues.push({
      row: rowIndex,
      field: 'controlId',
      code: 'missing_field',
      message: 'control id is required',
    });
    return undefined;
  }
  if (!CONTROL_ID_RE.test(controlId)) {
    issues.push({
      row: rowIndex,
      field: 'controlId',
      code: 'invalid_value',
      message: `control id "${controlId}" is not a valid Annex A reference`,
    });
    return undefined;
  }

  const applicabilityRaw = fields.applicability ?? '';
  const applicability = coerceApplicability(applicabilityRaw);
  if (applicability === undefined) {
    issues.push({
      row: rowIndex,
      field: 'applicability',
      code: 'invalid_value',
      message: `applicability "${applicabilityRaw}" not understood`,
    });
    return undefined;
  }

  const implRaw = fields.implementationStatus ?? '';
  let implementationStatus: z.infer<typeof SoaImplementationStatusSchema> | undefined;
  if (implRaw !== '') {
    implementationStatus = coerceImplementation(implRaw);
    if (implementationStatus === undefined) {
      issues.push({
        row: rowIndex,
        field: 'implementationStatus',
        code: 'invalid_value',
        message: `implementation status "${implRaw}" not understood`,
      });
      return undefined;
    }
  }

  const justification = fields.justification ?? '';
  if (applicability === 'not_applicable' && justification === '') {
    issues.push({
      row: rowIndex,
      field: 'justification',
      code: 'missing_field',
      message: 'justification required when applicability = not_applicable',
    });
    return undefined;
  }

  // Validate via zod to catch any future drift in the domain schema.
  const _ = SoaApplicabilitySchema.parse(applicability);
  void _;

  const now = (opts.now ?? (() => new Date().toISOString()))();

  const record: SoaRecord = {
    id: opts.newId(),
    firmId: opts.firmId,
    engagementId: opts.engagementId,
    controlId,
    applicability,
    importedAt: now,
    sourceRow: rowIndex,
    ...(implementationStatus !== undefined ? { implementationStatus } : {}),
    ...(justification !== '' ? { justification } : {}),
    ...(fields.internalReference !== undefined && fields.internalReference !== ''
      ? { internalReference: fields.internalReference }
      : {}),
    ...(fields.notes !== undefined && fields.notes !== '' ? { notes: fields.notes } : {}),
  };
  return record;
}

function buildResult(
  format: ValidationReport['format'],
  parsedRows: number,
  records: SoaRecord[],
  issues: ValidationIssue[],
): ImportResult {
  const dedup = dedupeByControl(records, issues);
  const accepted = dedup.length;
  const rejected = parsedRows - accepted;
  return {
    records: dedup,
    report: {
      format,
      totalRows: parsedRows,
      acceptedRows: accepted,
      rejectedRows: rejected < 0 ? 0 : rejected,
      issues,
    },
  };
}

function dedupeByControl(records: SoaRecord[], issues: ValidationIssue[]): SoaRecord[] {
  const seen = new Map<string, SoaRecord>();
  for (const r of records) {
    const existing = seen.get(r.controlId);
    if (existing !== undefined) {
      issues.push({
        row: r.sourceRow ?? 0,
        field: 'controlId',
        code: 'duplicate_control',
        message: `control "${r.controlId}" appears more than once; keeping first`,
      });
      continue;
    }
    seen.set(r.controlId, r);
  }
  return [...seen.values()];
}

/**
 * Importer that takes an already-parsed grid (headers + rows). Used as the
 * shared core for every textual importer (XLSX, CSV, PDF table extract).
 */
export function importFromGrid(
  format: ValidationReport['format'],
  grid: ParsedGrid,
  opts: ImportOptions,
): ImportResult {
  assertSafeRelativePath(opts.sourceFile);

  const aliases = { ...DEFAULT_ALIASES, ...(opts.columnAliases ?? {}) };
  const { map, unmapped } = normaliseHeaders(grid.headers, aliases);
  const issues: ValidationIssue[] = [];
  for (const idx of unmapped) {
    const header = grid.headers[idx];
    if (header !== undefined && header.trim() !== '') {
      issues.push({
        row: 0,
        field: header,
        code: 'invalid_value',
        message: `unrecognised column "${header}" - mapped to no canonical field`,
      });
    }
  }
  if (!Object.values(map).includes('controlId')) {
    issues.push({
      row: 0,
      code: 'missing_field',
      message: 'no column mapped to controlId; cannot import',
    });
    return buildResult(format, 0, [], issues);
  }

  const records: SoaRecord[] = [];
  let totalRows = 0;
  grid.rows.forEach((row, idx) => {
    const allBlank = row.every((c) => (c ?? '').toString().trim() === '');
    if (allBlank) {
      if (opts.skipBlankRows) return;
      issues.push({
        row: idx,
        code: 'malformed_row',
        message: 'row is entirely blank',
      });
      totalRows += 1;
      return;
    }
    totalRows += 1;
    const record = rowToRecord(row, idx, map, opts, issues);
    if (record !== undefined) records.push(record);
  });
  return buildResult(format, totalRows, records, issues);
}

// ---------- format-specific importers ----------

/**
 * XLSX importer. Accepts a pre-parsed grid because shipping `xlsx` (which
 * is heavyweight + has known prototype-pollution CVEs) into a domain
 * package is the wrong layer. Wire the parser at the application edge
 * and feed grids in.
 */
export function importFromXlsx(grid: ParsedGrid, opts: ImportOptions): ImportResult {
  return importFromGrid('xlsx', grid, opts);
}

export interface CsvImportInput {
  /** Raw CSV text. */
  text: string;
  /** Default ','. */
  delimiter?: string;
}

/**
 * CSV importer with a small, RFC4180-compatible parser. Handles quoted
 * fields with embedded commas and double-quote escapes (""). The parser
 * is intentionally minimal - production callers may swap in `papaparse`
 * by feeding `importFromGrid('csv', grid, opts)` directly.
 */
export function importFromCsv(input: CsvImportInput, opts: ImportOptions): ImportResult {
  const grid = parseCsv(input.text, input.delimiter ?? ',');
  return importFromGrid('csv', grid, opts);
}

export function parseCsv(text: string, delimiter: string): ParsedGrid {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === delimiter) {
      current.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r' && text[i + 1] === '\n') {
      current.push(field);
      rows.push(current);
      current = [];
      field = '';
      i += 2;
      continue;
    }
    if (c === '\n' || c === '\r') {
      current.push(field);
      rows.push(current);
      current = [];
      field = '';
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field !== '' || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = rows[0] ?? [];
  return { headers, rows: rows.slice(1) };
}

export interface JsonImportInput {
  /** Either a JSON string or an already-parsed unknown value. */
  data: string | unknown;
}

const JsonRecordSchema = z
  .object({
    controlId: z.string().optional(),
    control_id: z.string().optional(),
    control: z.string().optional(),
    applicability: z.string().optional(),
    applicable: z.union([z.string(), z.boolean()]).optional(),
    implementationStatus: z.string().optional(),
    implementation_status: z.string().optional(),
    status: z.string().optional(),
    justification: z.string().optional(),
    rationale: z.string().optional(),
    internalReference: z.string().optional(),
    internal_reference: z.string().optional(),
    notes: z.string().optional(),
    comment: z.string().optional(),
  })
  .passthrough();

const JsonFileSchema = z.union([
  z.array(JsonRecordSchema),
  z.object({
    records: z.array(JsonRecordSchema),
  }),
]);

function jsonItemToRow(item: z.infer<typeof JsonRecordSchema>): string[] {
  const controlId = item.controlId ?? item.control_id ?? item.control ?? '';
  const applicabilityRaw =
    item.applicability ??
    (typeof item.applicable === 'boolean'
      ? item.applicable
        ? 'yes'
        : 'no'
      : (item.applicable ?? ''));
  const status =
    item.implementationStatus ?? item.implementation_status ?? item.status ?? '';
  const justification = item.justification ?? item.rationale ?? '';
  const ref = item.internalReference ?? item.internal_reference ?? '';
  const notes = item.notes ?? item.comment ?? '';
  return [controlId, applicabilityRaw, status, justification, ref, notes];
}

/**
 * JSON importer. Accepts either an array of records or `{ records: [...] }`.
 * Field names follow the canonical names with snake_case fall-back for
 * vendor exports.
 */
export function importFromJson(input: JsonImportInput, opts: ImportOptions): ImportResult {
  let parsed: unknown;
  if (typeof input.data === 'string') {
    try {
      parsed = JSON.parse(input.data);
    } catch (e) {
      const issues: ValidationIssue[] = [
        {
          row: 0,
          code: 'malformed_row',
          message: `JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
        },
      ];
      return buildResult('json', 0, [], issues);
    }
  } else {
    parsed = input.data;
  }
  const result = JsonFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues: ValidationIssue[] = [
      {
        row: 0,
        code: 'malformed_row',
        message: `JSON does not match expected shape: ${result.error.message}`,
      },
    ];
    return buildResult('json', 0, [], issues);
  }
  const items = Array.isArray(result.data) ? result.data : result.data.records;
  const headers = [
    'controlId',
    'applicability',
    'implementationStatus',
    'justification',
    'internalReference',
    'notes',
  ];
  const rows = items.map(jsonItemToRow);
  return importFromGrid('json', { headers, rows }, opts);
}

export interface PdfTableImportInput {
  /**
   * Pre-extracted table rows. Application layers use `pdf2json`,
   * `pdfjs-dist`, or similar to extract a grid; this importer accepts
   * the post-extraction shape so it stays dependency-free.
   */
  grid: ParsedGrid;
}

/**
 * PDF table importer - delegates parsing to the grid form. The caller
 * MUST run a real PDF extractor first; we only accept structured tables.
 * This guarantees that any "PDF importer fuzz" is really exercising row
 * normalisation, not a third-party PDF parser.
 */
export function importFromPdfTable(
  input: PdfTableImportInput,
  opts: ImportOptions,
): ImportResult {
  return importFromGrid('pdf', input.grid, opts);
}
