// SPDX-License-Identifier: BUSL-1.1
import type { AiRiskRegisterEntry } from './domain.js';

export const MIT_AIR_CATEGORIES = [
  'discrimination_toxicity', 'privacy', 'misinformation', 'malicious_use',
  'human_machine_interaction', 'socioeconomic_environmental', 'ai_system_safety_failures',
];
export const AVID_CATEGORIES = ['security', 'ethics', 'performance'];
export const ATLAS_TACTICS = [
  'reconnaissance', 'resource_development', 'initial_access', 'ml_attack_staging',
  'execution', 'persistence', 'defense_evasion', 'discovery', 'collection',
  'ml_attack_exfiltration', 'impact',
];
export const OWASP_LLM10 = ['LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05', 'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10'];

export interface CrossCheckGap {
  framework: 'MIT_AIR' | 'AVID' | 'ATLAS' | 'OWASP_LLM10';
  missing: string[];
}

export function detectGaps(entries: AiRiskRegisterEntry[]): CrossCheckGap[] {
  const desc = entries.map((e) => `${e.riskTitle} ${e.description} ${e.category}`.toLowerCase()).join(' ');
  const gaps: CrossCheckGap[] = [];

  const checkAgainst = (framework: CrossCheckGap['framework'], tokens: string[]) => {
    const missing = tokens.filter((t) => !desc.includes(t.toLowerCase().replace(/[^a-z0-9]/g, ' ')));
    if (missing.length > 0) gaps.push({ framework, missing });
  };

  checkAgainst('MIT_AIR', MIT_AIR_CATEGORIES);
  checkAgainst('AVID', AVID_CATEGORIES);
  checkAgainst('ATLAS', ATLAS_TACTICS);
  checkAgainst('OWASP_LLM10', OWASP_LLM10);

  return gaps;
}
