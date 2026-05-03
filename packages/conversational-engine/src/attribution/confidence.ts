// SPDX-License-Identifier: BUSL-1.1
import {
  type ConfidenceBand,
  ConfidenceBandThresholds,
  classifyConfidence,
} from '../types/domain.js';

export { classifyConfidence, ConfidenceBandThresholds };
export type { ConfidenceBand };

export interface BandRouting {
  readonly band: ConfidenceBand;
  readonly autoLink: boolean;
  readonly singleClick: boolean;
  readonly optInPanelOnly: boolean;
}

export function routeBand(band: ConfidenceBand): BandRouting {
  switch (band) {
    case 'HIGH':
      return { band, autoLink: true, singleClick: false, optInPanelOnly: false };
    case 'MEDIUM':
      return { band, autoLink: false, singleClick: true, optInPanelOnly: false };
    case 'LOW':
    default:
      return { band, autoLink: false, singleClick: false, optInPanelOnly: true };
  }
}
