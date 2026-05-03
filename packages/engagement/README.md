# @auditforge/engagement

Engagement, audit programme, plan builder, audit team, and lifecycle workflow
primitives for AuditForge ISO/IEC 42001.

This package is the home of AuditForge's "Section 3.2 — Audit Programme &
Planning" capabilities (see `auditforge.md`). It implements:

- **Engagement** — one ISO/IEC 42001 certification cycle per client
- **AuditEvent** — Stage 1, Stage 2, Surveillance 1/2, Recertification, Special audits
- **AuditPlan** — drag-drop session timeline + conflict detection
- **AuditTeam** — role assignments + ISO 17021-1 impartiality / conflict-of-interest checks
- **Programme Calculator** — minimum man-day calculation per ISO 17021-1 Annex A and
  IAF MD 23 (AIMS-specific)
- **Workflows** — Stage1/Stage2/Surveillance/Recertification/Special audit state machines

The calculator's outputs are deterministic and the rationale is structured so
that an external accreditation reviewer (ANAB, UKAS, COFRAC, etc.) can
re-derive the result by reading the rationale lines.

> No standard text is reproduced in this package. All rationale lines reference
> clauses (e.g. "ISO/IEC 17021-1:2015 9.1.4", "IAF MD 23:2023 §5.2") so an
> auditor with their own licensed copy of the standard can verify the math.

## Public surface

```ts
import {
  // Types
  type Engagement,
  type AuditEvent,
  type AuditPlan,
  type AuditTeam,
  type ImpartialityCheck,

  // Programme calculator
  calculateProgramme,
  type ProgrammeInputs,
  type ProgrammeOutputs,

  // Plan
  buildPlan,
  detectPlanConflicts,
  applyPlanMove,
  PlanReceiptStateMachine,

  // Team
  evaluateImpartiality,

  // Workflows
  Stage1Workflow,
  Stage2Workflow,
  SurveillanceWorkflow,
  RecertificationWorkflow,
  SpecialAuditWorkflow,
} from '@auditforge/engagement';
```

## License

BUSL-1.1
