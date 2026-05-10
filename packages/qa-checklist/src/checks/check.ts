// SPDX-License-Identifier: BUSL-1.1
import type { ReportPublicationContext } from '../domain/context.js';
import type { ChecklistItemResult } from '../domain/result.js';

export interface ChecklistCheck {
  /** Stable identifier — used in override map and ledger events. */
  readonly id: string;
  readonly name: string;
  evaluate(ctx: ReportPublicationContext): Pick<ChecklistItemResult, 'status' | 'reason'>;
}
