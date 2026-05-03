// SPDX-License-Identifier: BUSL-1.1
import type { ImpactAssessment } from './domain.js';

export interface CompletenessReport {
  ok: boolean;
  missing: string[];
}

export function checkImpactAssessmentCompleteness(ia: ImpactAssessment): CompletenessReport {
  const missing: string[] = [];
  if (!ia.scope || ia.scope.length < 20) missing.push('scope (too brief)');
  if (ia.affectedStakeholders.length === 0) missing.push('affectedStakeholders');
  if (!ia.intendedBenefits || ia.intendedBenefits.length < 20) missing.push('intendedBenefits');
  if (!ia.potentialHarms || ia.potentialHarms.length < 20) missing.push('potentialHarms');
  if (!ia.mitigations || ia.mitigations.length < 20) missing.push('mitigations');
  if (!ia.residualRiskAssessment || ia.residualRiskAssessment.length < 20) missing.push('residualRiskAssessment');
  return { ok: missing.length === 0, missing };
}
