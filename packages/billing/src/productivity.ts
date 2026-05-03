// SPDX-License-Identifier: BUSL-1.1
import type { TimeEntry } from './domain.js';

export interface ProductivityInputs {
  timeEntries: TimeEntry[];
  capacityMinutes: number;
  onTime: boolean;
  ncQualityScore: number;
}

export interface ProductivityMetrics {
  utilization: number;
  onTime: boolean;
  ncQualityScore: number;
}

export function computeProductivity(i: ProductivityInputs): ProductivityMetrics {
  const billable = i.timeEntries
    .filter((e) => e.category !== 'admin' && e.category !== 'travel')
    .reduce((s, e) => s + e.minutes, 0);
  const utilization = i.capacityMinutes > 0 ? Math.min(1, billable / i.capacityMinutes) : 0;
  return { utilization, onTime: i.onTime, ncQualityScore: i.ncQualityScore };
}
