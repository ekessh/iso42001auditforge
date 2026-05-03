// SPDX-License-Identifier: BUSL-1.1
//
// Built-in template payloads. We deliberately import JSON via Node's JSON
// resolution rather than ship a separate `templates/` runtime tree at install
// time — `tsconfig.base.json` sets `resolveJsonModule: true`. The JSON files
// live at `packages/report-engine/templates/` so external lead auditors review
// them via PR diff.
//
// The host (apps/api) may override or add templates via `createRegistry`.

import stage1 from '../../templates/stage1.json' with { type: 'json' };
import stage2 from '../../templates/stage2.json' with { type: 'json' };
import surveillance from '../../templates/surveillance.json' with { type: 'json' };
import recertification from '../../templates/recertification.json' with { type: 'json' };
import findingsSummary from '../../templates/findings-summary.json' with { type: 'json' };
import technicalAnnex from '../../templates/technical-annex.json' with { type: 'json' };
import crossFrameworkAnnex from '../../templates/cross-framework-annex.json' with { type: 'json' };

import { parseTemplate } from './loader.js';
import { createRegistry, type TemplateRegistry } from './loader.js';
import type { ReportTemplate } from '../domain.js';

export const builtinTemplates: readonly ReportTemplate[] = Object.freeze([
  parseTemplate(stage1),
  parseTemplate(stage2),
  parseTemplate(surveillance),
  parseTemplate(recertification),
  parseTemplate(findingsSummary),
  parseTemplate(technicalAnnex),
  parseTemplate(crossFrameworkAnnex),
]);

export function builtinRegistry(): TemplateRegistry {
  return createRegistry(builtinTemplates);
}
