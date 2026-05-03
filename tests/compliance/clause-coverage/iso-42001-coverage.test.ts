// SPDX-License-Identifier: BUSL-1.1
/**
 * ISO/IEC 42001:2023 Catalogue Coverage Tests
 *
 * Asserts that:
 *  1. Clauses 4–10 (all top-level and sub-clauses) are present with non-empty
 *     titles in the ISO 42001 clause catalogue.
 *  2. Annex A categories A.2–A.10 are represented in the Annex A controls
 *     catalogue.
 *  3. At least one working-paper template file exists for each Annex A control
 *     family, loaded from the @auditforge/working-papers templates directory.
 *
 * References (no standard text reproduced):
 *  - ISO/IEC 42001:2023 clauses 4–10
 *  - ISO/IEC 42001:2023 Annex A controls A.2–A.10
 */
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  loadIso42001Clauses,
  loadAnnexAControls,
} from '../../../packages/catalogues/src/loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve path to the working-papers templates/annex-a directory.
const WP_TEMPLATES_ANNEX_A = join(
  __dirname,
  '../../../packages/working-papers/templates/annex-a',
);
const WP_TEMPLATES_CLAUSES = join(
  __dirname,
  '../../../packages/working-papers/templates/clauses',
);

// ---------------------------------------------------------------------------
// 1) ISO 42001 Clause coverage (clauses 4–10)
// ---------------------------------------------------------------------------
describe('ISO/IEC 42001:2023 — clause catalogue coverage', () => {
  it('loads all clauses without errors', async () => {
    const clauses = await loadIso42001Clauses();
    expect(clauses.length).toBeGreaterThan(0);
  });

  it('every loaded clause has a non-empty id', async () => {
    const clauses = await loadIso42001Clauses();
    for (const c of clauses) {
      expect(c.id.trim().length, `Clause id is empty: ${JSON.stringify(c)}`).toBeGreaterThan(0);
    }
  });

  it('every loaded clause has a non-empty title', async () => {
    const clauses = await loadIso42001Clauses();
    for (const c of clauses) {
      expect(c.title.trim().length, `Clause "${c.id}" has empty title`).toBeGreaterThan(0);
    }
  });

  const TOP_LEVEL_CLAUSES = ['4', '5', '6', '7', '8', '9', '10'];

  for (const clauseId of TOP_LEVEL_CLAUSES) {
    it(`top-level clause ${clauseId} is present`, async () => {
      const clauses = await loadIso42001Clauses();
      const found = clauses.find((c) => c.id === clauseId);
      expect(found, `Clause ${clauseId} not found in catalogue`).toBeDefined();
      expect(found!.title.length).toBeGreaterThan(0);
    });
  }

  // Sub-clause spot-checks
  const REQUIRED_SUB_CLAUSES: Record<string, string> = {
    '4.1': 'Understanding the organization and its context',
    '4.2': 'Understanding the needs',
    '4.3': 'Determining the scope',
    '5.1': 'Leadership and commitment',
    '5.2': 'AI policy',
    '6.1': 'Actions to address risks',
    '6.1.2': 'AI risk assessment',
    '6.1.3': 'AI risk treatment',
    '6.1.4': 'AI system impact assessment',
    '7.5': 'Documented information',
    '8.1': 'Operational planning',
    '9.1': 'Monitoring',
    '9.2': 'Internal audit',
    '9.3': 'Management review',
    '10.1': 'Continual improvement',
    '10.2': 'Nonconformity',
  };

  for (const [id, titleFragment] of Object.entries(REQUIRED_SUB_CLAUSES)) {
    it(`sub-clause ${id} present with expected title keyword`, async () => {
      const clauses = await loadIso42001Clauses();
      const found = clauses.find((c) => c.id === id);
      expect(found, `Sub-clause ${id} missing from catalogue`).toBeDefined();
      expect(
        found!.title.toLowerCase(),
        `Sub-clause ${id} title "${found!.title}" does not include "${titleFragment.toLowerCase()}"`,
      ).toContain(titleFragment.toLowerCase().split(' ')[0]);
    });
  }

  it('clauses are unique by id', async () => {
    const clauses = await loadIso42001Clauses();
    const ids = clauses.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// 2) Annex A Controls coverage (A.2–A.10)
// ---------------------------------------------------------------------------
describe('ISO/IEC 42001:2023 — Annex A catalogue coverage', () => {
  const REQUIRED_ANNEX_A_CATEGORIES = [
    'A.2', // Policies
    'A.3', // Internal organization
    'A.4', // Resources
    'A.5', // Impact assessment
    'A.6', // System lifecycle
    'A.7', // Data
    'A.8', // Information for interested parties
    'A.9', // Use of AI systems
    'A.10', // Third-party
  ];

  it('loads Annex A controls without errors', async () => {
    const controls = await loadAnnexAControls();
    expect(controls.length).toBeGreaterThan(0);
  });

  it('every Annex A control has non-empty id and title', async () => {
    const controls = await loadAnnexAControls();
    for (const c of controls) {
      expect(c.id.trim().length, `Empty id in control: ${JSON.stringify(c)}`).toBeGreaterThan(0);
      expect(c.title.trim().length, `Empty title in control ${c.id}`).toBeGreaterThan(0);
      expect(c.category.trim().length, `Empty category in control ${c.id}`).toBeGreaterThan(0);
    }
  });

  for (const categoryId of REQUIRED_ANNEX_A_CATEGORIES) {
    it(`Annex A category ${categoryId} (top-level) is present`, async () => {
      const controls = await loadAnnexAControls();
      const found = controls.find((c) => c.id === categoryId);
      expect(found, `Annex A category ${categoryId} not found`).toBeDefined();
    });
  }

  // Spot-check specific high-value controls
  const SPOT_CHECK_CONTROLS: string[] = [
    'A.5.4', // Impact on individuals/groups
    'A.6.2.5', // Deployment and robustness
    'A.6.2.7', // Technical documentation
    'A.7.4', // Data quality
    'A.7.5', // Data provenance
    'A.10.3', // Suppliers
  ];

  for (const controlId of SPOT_CHECK_CONTROLS) {
    it(`control ${controlId} present in Annex A`, async () => {
      const controls = await loadAnnexAControls();
      const found = controls.find((c) => c.id === controlId);
      expect(found, `Control ${controlId} not found in Annex A catalogue`).toBeDefined();
    });
  }

  it('Annex A controls are unique by id', async () => {
    const controls = await loadAnnexAControls();
    const ids = controls.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all Annex A control ids start with "A."', async () => {
    const controls = await loadAnnexAControls();
    for (const c of controls) {
      expect(
        c.id.startsWith('A.'),
        `Control id "${c.id}" does not start with "A."`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3) Working-paper template coverage — at least one per Annex A family
// ---------------------------------------------------------------------------
describe('Working-paper template coverage — Annex A families', () => {
  const ANNEX_A_FAMILY_PREFIXES: Record<string, string> = {
    'A2': 'A2-policies',
    'A3': 'A3-internal-organization',
    'A4': 'A4-resources',
    'A5': 'A5-impact-assessment',
    'A6': 'A6-system-lifecycle',
    'A7': 'A7-data',
    'A8': 'A8-information',
    'A9': 'A9-use-of-ai',
    'A10': 'A10-third-party',
  };

  it('annex-a templates directory exists and is non-empty', async () => {
    const files = await readdir(WP_TEMPLATES_ANNEX_A);
    expect(files.length).toBeGreaterThan(0);
  });

  for (const [family, expectedPrefix] of Object.entries(ANNEX_A_FAMILY_PREFIXES)) {
    it(`at least one working-paper template for Annex A family ${family}`, async () => {
      const files = await readdir(WP_TEMPLATES_ANNEX_A);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      const matchingFile = jsonFiles.find((f) =>
        f.toLowerCase().startsWith(expectedPrefix.toLowerCase().split('-')[0]!),
      );
      expect(
        matchingFile,
        `No template found for Annex A family ${family} (expected file starting with "${expectedPrefix}"), found: ${jsonFiles.join(', ')}`,
      ).toBeDefined();
    });
  }

  it('all annex-a template files parse as valid JSON', async () => {
    const { readFile } = await import('node:fs/promises');
    const files = await readdir(WP_TEMPLATES_ANNEX_A);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const content = await readFile(join(WP_TEMPLATES_ANNEX_A, file), 'utf8');
      let parsed: unknown;
      expect(
        () => {
          parsed = JSON.parse(content);
        },
        `File ${file} is not valid JSON`,
      ).not.toThrow();
      expect(parsed).toBeDefined();
    }
  });

  it('each annex-a template JSON has id, title, and sections fields', async () => {
    const { readFile } = await import('node:fs/promises');
    const files = await readdir(WP_TEMPLATES_ANNEX_A);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const content = await readFile(join(WP_TEMPLATES_ANNEX_A, file), 'utf8');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      expect(parsed.id, `${file} missing "id" field`).toBeDefined();
      expect(parsed.title, `${file} missing "title" field`).toBeDefined();
      expect(parsed.sections, `${file} missing "sections" field`).toBeDefined();
    }
  });

  it('clauses templates directory exists', async () => {
    const files = await readdir(WP_TEMPLATES_CLAUSES);
    expect(files.length).toBeGreaterThan(0);
  });

  const REQUIRED_CLAUSE_TEMPLATES = [
    'clause-4',
    'clause-5',
    'clause-6',
    'clause-7',
    'clause-8',
    'clause-9',
    'clause-10',
  ];

  for (const prefix of REQUIRED_CLAUSE_TEMPLATES) {
    it(`working-paper template for ${prefix} exists`, async () => {
      const files = await readdir(WP_TEMPLATES_CLAUSES);
      const match = files.find((f) => f.startsWith(prefix));
      expect(
        match,
        `No template found for ${prefix} in clauses templates dir. Files: ${files.join(', ')}`,
      ).toBeDefined();
    });
  }
});
