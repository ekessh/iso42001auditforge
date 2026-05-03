// SPDX-License-Identifier: BUSL-1.1
/**
 * ISO/IEC 17021-1:2015 clause 9.4 — Report template snapshot tests.
 *
 * Asserts that the four report templates (Stage 1, Stage 2, Surveillance,
 * Recertification) loaded from `@auditforge/report-engine` contain all
 * mandatory sections required by ISO/IEC 17021-1:2015 clause 9.4.
 *
 * DOCX content snapshot strategy: templates are JSON-defined; we normalise
 * the rendered text content (strip whitespace, lower-case) and compare to
 * a stable string snapshot. This gives byte-stable diffs without requiring
 * an actual DOCX binary renderer.
 *
 * References (no standard text reproduced):
 *  - ISO/IEC 17021-1:2015 clause 9.4 (audit report content)
 *  - ISO/IEC 17021-1:2015 clause 9.3 (audit programme)
 *  - ISO/IEC 17021-1:2015 clause 9.6.2 (surveillance)
 *  - ISO/IEC 17021-1:2015 clause 9.6.3 (recertification)
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATES_DIR = join(
  __dirname,
  '../../../packages/report-engine/templates',
);

// ---------------------------------------------------------------------------
// Template loader
// ---------------------------------------------------------------------------
interface ReportSection {
  id: string;
  title: string;
  body: string;
  required: boolean;
}

interface ReportTemplate {
  id: string;
  type: string;
  isoAnchor: string;
  version: string;
  variables: Record<string, { type: string; required: boolean; description?: string }>;
  sections: ReportSection[];
}

async function loadTemplate(filename: string): Promise<ReportTemplate> {
  const content = await readFile(join(TEMPLATES_DIR, filename), 'utf8');
  return JSON.parse(content) as ReportTemplate;
}

/** Normalise template body text for stable snapshot comparison. */
function normaliseBody(sections: ReportSection[]): string {
  return sections
    .map((s) =>
      [s.id, s.title, s.body.replace(/\s+/g, ' ').trim()]
        .join('|')
        .toLowerCase(),
    )
    .join('\n');
}

// ---------------------------------------------------------------------------
// Mandatory section checks per ISO/IEC 17021-1:2015 clause 9.4
// ---------------------------------------------------------------------------

/**
 * Check that a section exists by keyword search across section ids and titles.
 */
function hasSectionMatching(
  template: ReportTemplate,
  keywords: string[],
): boolean {
  return template.sections.some((s) => {
    const combined = `${s.id} ${s.title} ${s.body}`.toLowerCase();
    return keywords.every((kw) => combined.includes(kw.toLowerCase()));
  });
}

// ---------------------------------------------------------------------------
// Stage 1 Report
// ---------------------------------------------------------------------------
describe('Stage 1 report template — ISO 17021-1:2015 §9.4', () => {
  it('loads stage1.json without error', async () => {
    const t = await loadTemplate('stage1.json');
    expect(t.id).toBeDefined();
    expect(t.type).toBe('stage1');
  });

  it('isoAnchor is 9.4.1', async () => {
    const t = await loadTemplate('stage1.json');
    expect(t.isoAnchor).toBe('9.4.1');
  });

  it('contains scope section', async () => {
    const t = await loadTemplate('stage1.json');
    const found = hasSectionMatching(t, ['scope']);
    expect(found).toBe(true);
  });

  it('contains document review section', async () => {
    const t = await loadTemplate('stage1.json');
    const found = hasSectionMatching(t, ['review']);
    expect(found).toBe(true);
  });

  it('contains readiness assessment section', async () => {
    const t = await loadTemplate('stage1.json');
    const found = hasSectionMatching(t, ['readiness']);
    expect(found).toBe(true);
  });

  it('contains stage2 plan section', async () => {
    const t = await loadTemplate('stage1.json');
    const found = hasSectionMatching(t, ['stage', '2']) || hasSectionMatching(t, ['plan']);
    expect(found).toBe(true);
  });

  it('contains decision section', async () => {
    const t = await loadTemplate('stage1.json');
    const found = hasSectionMatching(t, ['decision']);
    expect(found).toBe(true);
  });

  it('has executiveSummary or scope as required variable', async () => {
    const t = await loadTemplate('stage1.json');
    const hasScope = t.variables['scope']?.required === true;
    expect(hasScope).toBe(true);
  });

  it('all required sections are present', async () => {
    const t = await loadTemplate('stage1.json');
    const required = t.sections.filter((s) => s.required);
    expect(required.length).toBeGreaterThanOrEqual(4);
  });

  it('snapshots section ids (stable)', async () => {
    const t = await loadTemplate('stage1.json');
    const ids = t.sections.map((s) => s.id).join(',');
    expect(ids).toMatchSnapshot();
  });

  it('snapshots normalised body content (byte-stable)', async () => {
    const t = await loadTemplate('stage1.json');
    expect(normaliseBody(t.sections)).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Stage 2 Report — full mandatory sections per ISO 17021-1:2015 §9.4.8
// ---------------------------------------------------------------------------
describe('Stage 2 report template — ISO 17021-1:2015 §9.4.8', () => {
  it('loads stage2.json without error', async () => {
    const t = await loadTemplate('stage2.json');
    expect(t.id).toBeDefined();
    expect(t.type).toBe('stage2');
  });

  it('isoAnchor is 9.4.8', async () => {
    const t = await loadTemplate('stage2.json');
    expect(t.isoAnchor).toBe('9.4.8');
  });

  it('contains executive summary section', async () => {
    const t = await loadTemplate('stage2.json');
    const found = hasSectionMatching(t, ['executive', 'summary']);
    expect(found).toBe(true);
  });

  it('contains scope section', async () => {
    const t = await loadTemplate('stage2.json');
    const found = hasSectionMatching(t, ['scope']);
    expect(found).toBe(true);
  });

  it('contains audit team section', async () => {
    const t = await loadTemplate('stage2.json');
    const found = hasSectionMatching(t, ['team']);
    expect(found).toBe(true);
  });

  it('contains audit programme section', async () => {
    const t = await loadTemplate('stage2.json');
    const found = hasSectionMatching(t, ['programme']);
    expect(found).toBe(true);
  });

  it('contains methodology section', async () => {
    const t = await loadTemplate('stage2.json');
    const found = hasSectionMatching(t, ['methodology']);
    expect(found).toBe(true);
  });

  it('contains findings summary section', async () => {
    const t = await loadTemplate('stage2.json');
    const found = hasSectionMatching(t, ['findings']);
    expect(found).toBe(true);
  });

  it('contains NC list section', async () => {
    const t = await loadTemplate('stage2.json');
    const found = hasSectionMatching(t, ['non-conformit']) || hasSectionMatching(t, ['nc-list']) || hasSectionMatching(t, ['nc']);
    expect(found).toBe(true);
  });

  it('contains OFI list section', async () => {
    const t = await loadTemplate('stage2.json');
    const found = hasSectionMatching(t, ['ofi']) || hasSectionMatching(t, ['opportunit']);
    expect(found).toBe(true);
  });

  it('contains conformity statement section', async () => {
    const t = await loadTemplate('stage2.json');
    const found = hasSectionMatching(t, ['conformity']);
    expect(found).toBe(true);
  });

  it('contains recommendation section', async () => {
    const t = await loadTemplate('stage2.json');
    const found = hasSectionMatching(t, ['recommendation']);
    expect(found).toBe(true);
  });

  it('executiveSummary is a required variable', async () => {
    const t = await loadTemplate('stage2.json');
    expect(t.variables['executiveSummary']?.required).toBe(true);
  });

  it('recommendation is a required variable', async () => {
    const t = await loadTemplate('stage2.json');
    expect(t.variables['recommendation']?.required).toBe(true);
  });

  it('ncs variable is required', async () => {
    const t = await loadTemplate('stage2.json');
    expect(t.variables['ncs']?.required).toBe(true);
  });

  it('snapshots section ids', async () => {
    const t = await loadTemplate('stage2.json');
    const ids = t.sections.map((s) => s.id).join(',');
    expect(ids).toMatchSnapshot();
  });

  it('snapshots normalised body content', async () => {
    const t = await loadTemplate('stage2.json');
    expect(normaliseBody(t.sections)).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Surveillance Report — ISO 17021-1:2015 §9.6.2
// ---------------------------------------------------------------------------
describe('Surveillance report template — ISO 17021-1:2015 §9.6', () => {
  it('loads surveillance.json without error', async () => {
    const t = await loadTemplate('surveillance.json');
    expect(t.type).toBe('surveillance');
  });

  it('isoAnchor is 9.6.3', async () => {
    const t = await loadTemplate('surveillance.json');
    expect(t.isoAnchor).toBe('9.6.3');
  });

  it('contains nc follow-up section', async () => {
    const t = await loadTemplate('surveillance.json');
    const found = hasSectionMatching(t, ['follow']) || hasSectionMatching(t, ['nc-followup']);
    expect(found).toBe(true);
  });

  it('contains sampled areas section', async () => {
    const t = await loadTemplate('surveillance.json');
    const found = hasSectionMatching(t, ['sample']) || hasSectionMatching(t, ['area']);
    expect(found).toBe(true);
  });

  it('contains trends section', async () => {
    const t = await loadTemplate('surveillance.json');
    const found = hasSectionMatching(t, ['trend']);
    expect(found).toBe(true);
  });

  it('contains recommendation section', async () => {
    const t = await loadTemplate('surveillance.json');
    const found = hasSectionMatching(t, ['recommendation']);
    expect(found).toBe(true);
  });

  it('cycleYear is a required variable', async () => {
    const t = await loadTemplate('surveillance.json');
    expect(t.variables['cycleYear']?.required).toBe(true);
  });

  it('snapshots section ids', async () => {
    const t = await loadTemplate('surveillance.json');
    const ids = t.sections.map((s) => s.id).join(',');
    expect(ids).toMatchSnapshot();
  });

  it('snapshots normalised body content', async () => {
    const t = await loadTemplate('surveillance.json');
    expect(normaliseBody(t.sections)).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Recertification Report — ISO 17021-1:2015 §9.6.3
// ---------------------------------------------------------------------------
describe('Recertification report template — ISO 17021-1:2015 §9.6.3', () => {
  it('loads recertification.json without error', async () => {
    const t = await loadTemplate('recertification.json');
    expect(t.type).toBe('recertification');
  });

  it('isoAnchor is 9.6.3.2', async () => {
    const t = await loadTemplate('recertification.json');
    expect(t.isoAnchor).toBe('9.6.3.2');
  });

  it('contains audit team section', async () => {
    const t = await loadTemplate('recertification.json');
    const found = hasSectionMatching(t, ['team']);
    expect(found).toBe(true);
  });

  it('contains full audit/full re-audit section', async () => {
    const t = await loadTemplate('recertification.json');
    const found = hasSectionMatching(t, ['full']) || hasSectionMatching(t, ['audit']);
    expect(found).toBe(true);
  });

  it('contains performance trend section', async () => {
    const t = await loadTemplate('recertification.json');
    const found = hasSectionMatching(t, ['trend']) || hasSectionMatching(t, ['performance']);
    expect(found).toBe(true);
  });

  it('contains NC list section', async () => {
    const t = await loadTemplate('recertification.json');
    const found = hasSectionMatching(t, ['ncs']) || hasSectionMatching(t, ['non-conformit']);
    expect(found).toBe(true);
  });

  it('contains OFI section', async () => {
    const t = await loadTemplate('recertification.json');
    const found = hasSectionMatching(t, ['ofi']) || hasSectionMatching(t, ['opportunit']);
    expect(found).toBe(true);
  });

  it('contains recommendation section', async () => {
    const t = await loadTemplate('recertification.json');
    const found = hasSectionMatching(t, ['recommendation']);
    expect(found).toBe(true);
  });

  it('performanceTrend is required variable', async () => {
    const t = await loadTemplate('recertification.json');
    expect(t.variables['performanceTrend']?.required).toBe(true);
  });

  it('snapshots section ids', async () => {
    const t = await loadTemplate('recertification.json');
    const ids = t.sections.map((s) => s.id).join(',');
    expect(ids).toMatchSnapshot();
  });

  it('snapshots normalised body content', async () => {
    const t = await loadTemplate('recertification.json');
    expect(normaliseBody(t.sections)).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Cross-template structural checks
// ---------------------------------------------------------------------------
describe('Cross-template structural invariants', () => {
  const ALL_TEMPLATES = [
    'stage1.json',
    'stage2.json',
    'surveillance.json',
    'recertification.json',
  ];

  for (const filename of ALL_TEMPLATES) {
    it(`${filename} is valid JSON`, async () => {
      const content = await readFile(join(TEMPLATES_DIR, filename), 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it(`${filename} has id, type, version, sections`, async () => {
      const t = await loadTemplate(filename);
      expect(t.id).toBeDefined();
      expect(t.type).toBeDefined();
      expect(t.version).toBeDefined();
      expect(Array.isArray(t.sections)).toBe(true);
      expect(t.sections.length).toBeGreaterThan(0);
    });

    it(`${filename} all sections have id, title, body`, async () => {
      const t = await loadTemplate(filename);
      for (const s of t.sections) {
        expect(s.id.length, `Section in ${filename} missing id`).toBeGreaterThan(0);
        expect(s.title.length, `Section ${s.id} in ${filename} missing title`).toBeGreaterThan(0);
        expect(s.body.length, `Section ${s.id} in ${filename} missing body`).toBeGreaterThan(0);
      }
    });

    it(`${filename} section ids are unique`, async () => {
      const t = await loadTemplate(filename);
      const ids = t.sections.map((s) => s.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it(`${filename} all required variables declared`, async () => {
      const t = await loadTemplate(filename);
      const requiredVars = Object.entries(t.variables)
        .filter(([, v]) => v.required)
        .map(([k]) => k);
      expect(requiredVars.length).toBeGreaterThan(0);
    });
  }
});
