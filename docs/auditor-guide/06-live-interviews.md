<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Live Interviews

> This document covers the live interview session: audio recording,
> interviewee consent, real-time transcription, speaker diarization,
> clause attribution sidebar, and coverage delta display.

---

## Consent Requirements

Recording a conversation without consent is illegal in most jurisdictions
and inconsistent with ISO 17021-1 impartiality requirements. AuditForge
enforces consent before any recording begins.

1. Before starting a live session, click **Collect Consent**.
2. The system displays a consent statement that includes: scope of
   recording, purpose (audit transcript), retention period, right to
   withdraw before transcription is finalized.
3. Each interviewee must acknowledge consent. The auditor selects:
   - **Written consent** (signed in the system by each participant).
   - **Verbal consent** (recorded as the first utterance; auto-flagged
     for auditor confirmation).
4. Consent records are stored in `packages/consent-registry`, signed,
   and ledger-anchored (`consent.recorded` event).
5. If the auditee organization uses cloud LLM for transcription,
   **separate written consent** for cloud data processing is required.
   See [../concepts/consent-and-air-gap.md](../concepts/consent-and-air-gap.md).

---

## Starting a Live Session

1. Open the engagement and click **New Interview → Live Session**.
2. Select: date, interviewee(s), focus clauses (pre-populated from the
   audit plan; editable).
3. Click **Start Session**. This calls `POST /v1/interviews` with
   `type: live`.
4. The Interview Composer opens with:
   - **Left panel**: question queue (from the Question Generator).
   - **Center panel**: transcript feed (streaming).
   - **Right panel**: coverage delta sidebar (updates with each attributed
     utterance).

---

## Audio Recording and Transcription

Audio is captured in the browser via the Web Audio API and streamed to
`services/transcription-py` (WhisperX + Pyannote 3.1) over a WebSocket.

- **Model**: WhisperX medium or large-v3 (configurable per deployment).
  Local by default (Whisper runs on the server GPU); cloud Whisper API
  opt-in per engagement with consent.
- **Diarization**: Pyannote 3.1 assigns a speaker label (`SPEAKER_00`,
  `SPEAKER_01`, …) to each utterance segment. The auditor maps labels to
  participant names at session start.
- **Language**: auto-detected; override available per session.
- **Chunking**: transcription emits partial utterances at 3-second
  intervals. The attribution engine processes each confirmed utterance
  immediately.

---

## Real-Time Clause Attribution

As utterances stream in:

1. The attribution engine extracts claims from each utterance.
2. Claims are attributed to clauses with confidence scores.
3. The coverage delta sidebar shows which clauses moved from `untouched`
   to `partial` or `evidenced` since the session started.

The auditor can:

- **Accept** a clause attribution (single-click for medium confidence;
  bulk for high confidence).
- **Reject** an attribution with a reason.
- **Flag** an utterance for follow-up without attributing it.

All accept/reject actions emit ledger events.

---

## Coverage Delta Sidebar

The sidebar shows a live diff of the coverage matrix:

```
§6.1.2  untouched → partial   (+1 claim)
§6.1.3  partial   → evidenced (+2 claims, confidence 0.91)
§8.2    untouched            (0 claims this session)
```

Clauses at risk of remaining `untouched` are highlighted in amber. The
auditor uses this to decide whether to deviate from the question queue
and probe a gap.

The sidebar also shows the **estimated remaining time** to reach the
coverage threshold defined in the audit plan.

---

## Ending the Session

1. Click **End Session**. This calls `PATCH /v1/interviews/{id}/end`.
2. The system:
   - Stops the audio stream.
   - Finalizes pending transcription chunks (up to 30-second tail).
   - Runs a final attribution pass on any unattributed utterances.
   - Emits `interview.ended` to the ledger.
3. The full transcript is available at
   `GET /v1/interviews/{id}/transcript`.
4. Candidate NCs generated during the session appear in the Candidate
   Findings panel.

---

## Post-Session Review

After the session:

1. Review the transcript for missed attributions (the attribution engine
   marks uncertain utterances with a `⚠` icon).
2. Confirm or reject remaining attributions.
3. Edit the interview summary working paper.
4. File evidence links from the session.

---

## Related Documents

- [05-conversational-engine.md](05-conversational-engine.md) — engine
  internals.
- [09-findings-workflow.md](09-findings-workflow.md) — after candidate
  NCs are generated.
- [../concepts/consent-and-air-gap.md](../concepts/consent-and-air-gap.md)
  — consent and cloud guard.
