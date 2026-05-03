// SPDX-License-Identifier: BUSL-1.1
import {
  type ClauseFamily,
  type ClauseState,
  type ClauseStatus,
  DEFAULT_WEIGHT_CONFIG,
  type SoaScope,
  type WeightConfig,
} from '../src/index.js';

export const ENGAGEMENT_ID = '11111111-1111-4111-8111-111111111111';

export function clause(
  clauseId: string,
  family: ClauseFamily,
  status: ClauseStatus,
  opts: { mandatory?: boolean; inScope?: boolean; naRationale?: string } = {},
): ClauseState {
  return {
    clauseId,
    family,
    status,
    mandatory: opts.mandatory ?? family === 'main_body',
    inScope: opts.inScope ?? true,
    ...(opts.naRationale ? { naRationale: opts.naRationale } : {}),
  };
}

export function soa(inScopeIds: string[]): SoaScope {
  return { inScopeClauseIds: inScopeIds };
}

export function defaultConfig(): WeightConfig {
  return { ...DEFAULT_WEIGHT_CONFIG };
}

export function configWith(overrides: Partial<WeightConfig>): WeightConfig {
  return { ...DEFAULT_WEIGHT_CONFIG, ...overrides };
}
