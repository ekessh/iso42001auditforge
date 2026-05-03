// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  importFromCsv,
  importFromGrid,
  importFromJson,
  importFromPdfTable,
  importFromXlsx,
  parseCsv,
} from '../src/importers.js';
import {
  ENGAGEMENT_ID,
  FIRM_ID,
  fixedNow,
  makeIdFactory,
} from './fixtures.js';

const baseOpts = () => ({
  sourceFile: 'imports/soa.xlsx',
  engagementId: ENGAGEMENT_ID,
  firmId: FIRM_ID,
  newId: makeIdFactory(),
  now: fixedNow,
});

describe('importFromGrid', () => {
  it('imports a minimal applicable row', () => {
    const grid = {
      headers: ['controlId', 'applicability'],
      rows: [['A.5.4', 'applicable']],
    };
    const r = importFromGrid('xlsx', grid, baseOpts());
    expect(r.records).toHaveLength(1);
    expect(r.report.acceptedRows).toBe(1);
    expect(r.records[0]?.controlId).toBe('A.5.4');
    expect(r.records[0]?.applicability).toBe('applicable');
  });

  it('rejects rows with missing controlId', () => {
    const grid = {
      headers: ['controlId', 'applicability'],
      rows: [['', 'applicable']],
    };
    const r = importFromGrid('xlsx', grid, baseOpts());
    expect(r.records).toHaveLength(0);
    expect(r.report.issues.some((i) => i.code === 'missing_field')).toBe(true);
  });

  it('rejects rows with malformed control ids', () => {
    const grid = {
      headers: ['controlId', 'applicability'],
      rows: [['NotAControl', 'applicable'], ['SELECT * FROM users', 'applicable']],
    };
    const r = importFromGrid('xlsx', grid, baseOpts());
    expect(r.records).toHaveLength(0);
    expect(r.report.issues.filter((i) => i.code === 'invalid_value').length).toBeGreaterThanOrEqual(2);
  });

  it('requires justification when not_applicable', () => {
    const grid = {
      headers: ['controlId', 'applicability', 'justification'],
      rows: [['A.5.4', 'not_applicable', '']],
    };
    const r = importFromGrid('xlsx', grid, baseOpts());
    expect(r.records).toHaveLength(0);
    expect(r.report.issues.some((i) => i.field === 'justification')).toBe(true);
  });

  it('accepts not_applicable when justified', () => {
    const grid = {
      headers: ['controlId', 'applicability', 'justification'],
      rows: [['A.5.4', 'not_applicable', 'No automated decisioning in scope']],
    };
    const r = importFromGrid('xlsx', grid, baseOpts());
    expect(r.records).toHaveLength(1);
    expect(r.records[0]?.applicability).toBe('not_applicable');
    expect(r.records[0]?.justification).toContain('No automated');
  });

  it('reports duplicate control ids and keeps first occurrence', () => {
    const grid = {
      headers: ['controlId', 'applicability'],
      rows: [
        ['A.5.4', 'applicable'],
        ['A.5.4', 'not_applicable'],
      ],
    };
    const r = importFromGrid('xlsx', grid, baseOpts());
    expect(r.records).toHaveLength(1);
    expect(r.report.issues.some((i) => i.code === 'duplicate_control')).toBe(true);
  });

  it('skips entirely blank rows when configured', () => {
    const grid = {
      headers: ['controlId', 'applicability'],
      rows: [['', ''], ['A.5.4', 'applicable']],
    };
    const r = importFromGrid('xlsx', grid, { ...baseOpts(), skipBlankRows: true });
    expect(r.records).toHaveLength(1);
    expect(r.report.totalRows).toBe(1);
  });

  it('flags blank rows when not skipped', () => {
    const grid = { headers: ['controlId', 'applicability'], rows: [['', '']] };
    const r = importFromGrid('xlsx', grid, baseOpts());
    expect(r.report.issues.some((i) => i.code === 'malformed_row')).toBe(true);
  });

  it('coerces synonym values for applicability', () => {
    const grid = {
      headers: ['controlId', 'applicability'],
      rows: [
        ['A.5.4', 'yes'],
        ['A.5.5', 'YES'],
        ['A.6.1', '1'],
        ['A.6.2', 'in scope'],
      ],
    };
    const r = importFromGrid('xlsx', grid, baseOpts());
    expect(r.records).toHaveLength(4);
    expect(r.records.every((rec) => rec.applicability === 'applicable')).toBe(true);
  });

  it('refuses imports with no controlId column', () => {
    const grid = { headers: ['name', 'applicability'], rows: [['x', 'applicable']] };
    const r = importFromGrid('xlsx', grid, baseOpts());
    expect(r.records).toHaveLength(0);
    expect(r.report.issues.some((i) => i.code === 'missing_field')).toBe(true);
  });

  it('rejects malicious file paths in the import options', () => {
    const grid = { headers: ['controlId', 'applicability'], rows: [['A.5.4', 'applicable']] };
    expect(() =>
      importFromGrid('xlsx', grid, {
        ...baseOpts(),
        sourceFile: '/etc/passwd',
      }),
    ).toThrow();
    expect(() =>
      importFromGrid('xlsx', grid, {
        ...baseOpts(),
        sourceFile: '../../etc/passwd',
      }),
    ).toThrow();
  });

  it('honours custom column aliases', () => {
    const grid = {
      headers: ['Annex Control', 'In Scope?'],
      rows: [['A.5.4', 'yes']],
    };
    const r = importFromGrid('xlsx', grid, {
      ...baseOpts(),
      columnAliases: { annex_control: 'controlId', 'in_scope?': 'applicability' },
    });
    expect(r.records).toHaveLength(1);
  });

  it('accepts implementation status synonyms', () => {
    const grid = {
      headers: ['controlId', 'applicability', 'status'],
      rows: [
        ['A.5.4', 'applicable', 'in progress'],
        ['A.5.5', 'applicable', 'Implemented'],
      ],
    };
    const r = importFromGrid('xlsx', grid, baseOpts());
    expect(r.records[0]?.implementationStatus).toBe('partially_implemented');
    expect(r.records[1]?.implementationStatus).toBe('implemented');
  });
});

describe('CSV importer', () => {
  it('parses a quoted CSV with embedded commas and newlines', () => {
    const csv = `controlId,applicability,justification
A.5.4,applicable,"in scope, fully reviewed"
A.5.5,not_applicable,"Multi-line
justification covering both halves"`;
    const r = importFromCsv({ text: csv }, baseOpts());
    expect(r.records).toHaveLength(2);
    expect(r.records[0]?.justification).toContain('fully reviewed');
    expect(r.records[1]?.justification).toContain('Multi-line');
  });

  it('handles escaped double quotes in CSV', () => {
    const csv = `controlId,applicability,notes
A.5.4,applicable,"He said ""hi"""`;
    const r = importFromCsv({ text: csv }, baseOpts());
    expect(r.records[0]?.notes).toBe('He said "hi"');
  });

  it('parses CRLF line endings', () => {
    const csv = 'controlId,applicability\r\nA.5.4,applicable\r\nA.5.5,applicable\r\n';
    const r = importFromCsv({ text: csv }, baseOpts());
    expect(r.records).toHaveLength(2);
  });

  it('treats empty CSV as zero rows', () => {
    const r = importFromCsv({ text: '' }, baseOpts());
    expect(r.records).toHaveLength(0);
  });

  it('parses semicolon-delimited CSV when delimiter overridden', () => {
    const csv = 'controlId;applicability\nA.5.4;applicable';
    const r = importFromCsv({ text: csv, delimiter: ';' }, baseOpts());
    expect(r.records).toHaveLength(1);
  });

  it('parseCsv returns headers and rows separately', () => {
    const grid = parseCsv('a,b\n1,2\n3,4', ',');
    expect(grid.headers).toEqual(['a', 'b']);
    expect(grid.rows).toEqual([['1', '2'], ['3', '4']]);
  });
});

describe('JSON importer', () => {
  it('imports an array of records', () => {
    const data = JSON.stringify([
      { controlId: 'A.5.4', applicability: 'applicable' },
      { control_id: 'A.5.5', applicable: true },
    ]);
    const r = importFromJson({ data }, baseOpts());
    expect(r.records).toHaveLength(2);
  });

  it('imports a wrapper object { records: [...] }', () => {
    const data = JSON.stringify({
      records: [{ controlId: 'A.5.4', applicability: 'applicable' }],
    });
    const r = importFromJson({ data }, baseOpts());
    expect(r.records).toHaveLength(1);
  });

  it('reports parse errors', () => {
    const r = importFromJson({ data: '{not json' }, baseOpts());
    expect(r.records).toHaveLength(0);
    expect(r.report.issues.some((i) => i.code === 'malformed_row')).toBe(true);
  });

  it('reports schema mismatch', () => {
    const r = importFromJson({ data: JSON.stringify({ wrong: true }) }, baseOpts());
    expect(r.records).toHaveLength(0);
  });

  it('accepts boolean applicable: true/false', () => {
    const data = [
      { controlId: 'A.5.4', applicable: true },
      { controlId: 'A.5.5', applicable: false, justification: 'no LLM in scope' },
    ];
    const r = importFromJson({ data }, baseOpts());
    expect(r.records).toHaveLength(2);
    expect(r.records[0]?.applicability).toBe('applicable');
    expect(r.records[1]?.applicability).toBe('not_applicable');
  });
});

describe('PDF table importer', () => {
  it('delegates to grid importer', () => {
    const r = importFromPdfTable(
      {
        grid: {
          headers: ['controlId', 'applicability'],
          rows: [['A.5.4', 'applicable']],
        },
      },
      { ...baseOpts(), sourceFile: 'imports/soa.pdf' },
    );
    expect(r.records).toHaveLength(1);
    expect(r.report.format).toBe('pdf');
  });

  it('reports failures from broken extracted tables', () => {
    const r = importFromPdfTable(
      {
        grid: {
          headers: ['controlId', 'applicability'],
          rows: [
            ['A.5.4', 'maybe'],
            ['', 'applicable'],
          ],
        },
      },
      { ...baseOpts(), sourceFile: 'imports/soa.pdf' },
    );
    expect(r.records).toHaveLength(0);
    expect(r.report.issues.length).toBeGreaterThanOrEqual(2);
  });
});

describe('XLSX importer', () => {
  it('delegates to grid importer with format xlsx', () => {
    const r = importFromXlsx(
      { headers: ['controlId', 'applicability'], rows: [['A.5.4', 'applicable']] },
      baseOpts(),
    );
    expect(r.report.format).toBe('xlsx');
    expect(r.records).toHaveLength(1);
  });
});

describe('importer fuzz', () => {
  function randomCell(seed: number): string {
    const fuzz = ['', 'A.5.4', 'invalid', 'applicable', 'no', 'TBD', '\x00bad', 'A.7.4'];
    return fuzz[seed % fuzz.length] ?? '';
  }

  it('survives random garbage without throwing', () => {
    const headers = ['controlId', 'applicability', 'justification'];
    const rows: string[][] = [];
    for (let i = 0; i < 200; i++) {
      rows.push([randomCell(i * 3), randomCell(i * 5 + 1), randomCell(i * 7 + 2)]);
    }
    const r = importFromGrid('xlsx', { headers, rows }, baseOpts());
    // Some rows may be valid - but the call must not throw and must report issues for the rest.
    expect(r.report.totalRows).toBeGreaterThan(0);
    expect(r.report.issues.length).toBeGreaterThan(0);
  });

  it('handles very long justification text', () => {
    const long = 'X'.repeat(15_000);
    const grid = {
      headers: ['controlId', 'applicability', 'justification'],
      rows: [['A.5.4', 'not_applicable', long]],
    };
    const r = importFromGrid('xlsx', grid, baseOpts());
    expect(r.records).toHaveLength(1);
  });
});
