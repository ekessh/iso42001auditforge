# @auditforge/interviews

Interview manager for AuditForge ISO 42001 lead-auditor workbench. Implements
the interview portion of Section 3.10 / Phase 10 (`auditforge.md`).

License: BUSL-1.1.

## Scope

Pure-domain library: interview session lifecycle, curated prep-question
library (`data/questions.json`), notes, action-item state machine. No
transports, no persistence — those live in `apps/api`.

## Domain

- `InterviewSession` — schedule, attendees, status, linked WPs
- `InterviewQuestion` — library + curated; tagged by clause, control,
  AI-system type, stakeholder role
- `InterviewNote` — auditor notes attached to a session/question
- `ActionItem` — outcome of an interview; small state machine

## Question Library

`data/questions.json` ships 200+ curated questions, organized along four
axes per `auditforge.md` Section 3.10:

1. ISO 42001 clause (4-10)
2. Annex A control families (A.2-A.10)
3. AI system type (LLM, predictive ML, agent, RAG, multi-agent, training
   pipeline, MCP, vector DB)
4. Stakeholder role (developer, data scientist, MLOps, business owner,
   compliance)

Each question carries:

```ts
{
  id: string;                       // stable, prefixed (`Q-CL-...`, `Q-AX-...`)
  text: string;                     // the question to ask
  intentRationale: string;          // why we ask it (audit-trail)
  expectedEvidenceTypes: string[];  // policy | log | screenshot | dataset | ...
  mappedClauses: string[];          // ISO 42001 clauses
  followUps: string[];              // probing follow-ups
  // tags
  axis: 'clause' | 'annex' | 'aiSystemType' | 'role';
  aiSystemTypes?: string[];
  stakeholderRoles?: string[];
}
```

## Services

- `QuestionLibrary` — load + index + filter (by clause / annex / AI system /
  role / free-text)
- `InterviewScheduler` — schedule, reschedule, cancel, conflict checks
- `InterviewNotesService` — capture/replace notes
- `ActionItemStateMachine` — `open → in_progress → resolved | cancelled`
  with optional `blocked` parking lot

## Tests

25+ vitest cases:

- Library loads, all entries pass schema, axis coverage
- Filtering by clause / annex / AI-type / role
- Scheduler conflict detection
- Action-item state-machine transitions (allowed + forbidden)
- Property-based round-trips on the library
