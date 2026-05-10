// SPDX-License-Identifier: BUSL-1.1
//
// Backwards-compatibility re-export. Canonical impl lives in
// @auditforge/cost-controller; we keep the local symbol names so existing
// callers and tests don't churn while exposing the new event sink.

import {
  CostController as PkgCostController,
  type CostControllerOpts as PkgCostControllerOpts,
  type BudgetSnapshot,
  type CostBudget,
  type CostDecision,
  type CostEvent,
  type CostEventName,
  type CostEventSink,
  type CostStore,
  InMemoryCostEventSink,
  InMemoryCostStore,
} from '@auditforge/cost-controller';

export {
  CostBudget,
  BudgetSnapshot,
  CostDecision,
  CostEvent,
  CostEventName,
  CostEventSink,
  CostStore,
  InMemoryCostEventSink,
  InMemoryCostStore,
};

export type CostControllerOpts = PkgCostControllerOpts;

export class CostController extends PkgCostController {
  // WHY: the original signature was `(store, warnAt = 0.8)`; keep that
  // overload alive but also accept the richer opts bag.
  constructor(store: CostStore, optsOrWarn: PkgCostControllerOpts | number = {}) {
    if (typeof optsOrWarn === 'number') {
      super(store, { warnAt: optsOrWarn });
    } else {
      super(store, optsOrWarn);
    }
  }
}
