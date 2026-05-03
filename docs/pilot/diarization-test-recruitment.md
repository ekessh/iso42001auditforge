# Pilot Recruitment Plan — Live-Interview Diarization Test

**Goal:** validate the v3 §15.16 Live Interview composer (WhisperX + Pyannote 3.1 + whisper.cpp) under real audit conditions before Phase 7.6 GA. Confirm DER and word-error-rate stay inside the budget that lets candidate findings keep flowing in real time.

## What we measure

| Metric | Target | How |
|---|---|---|
| Diarization Error Rate (DER) | < 18% on multi-speaker audit interviews | Pyannote eval against auditor-corrected truth |
| Word Error Rate (WER) | < 12% on technical AIMS terminology | WhisperX vs corrected transcript |
| Speaker confusion rate | < 5% within first 10 utterances | Manual annotation of auto-labels |
| Time from utterance end to attribution candidate visible | < 3s local-medium / < 1.5s cloud | Stopwatch + telemetry |
| Auditor "did the engine keep up?" yes-rate | > 85% | Post-session 5-point Likert |
| Privacy incidents (data left local) | 0 | Egress monitor on probe sandbox |

## Pilot cohort — who we recruit

**Five (5) certified ISO 42001 lead auditors. Two from CBs, three independent. At least one per region: NA, EU, APAC.**

Recruitment criteria:

- Holds current ISO/IEC 42001 lead-auditor certification (UKAS/ANAB-recognized scheme acceptable).
- Has performed ≥ 3 AIMS audits in the last 12 months.
- Available for two 90-minute sessions in the pilot window.
- Willing to record and re-listen to their own interview audio (we do not retain after the pilot — see privacy below).
- Operating environment includes at least one of: Windows 11, macOS Apple Silicon, Linux desktop, iPad.

Diversity asks:

- Mix of CB lead auditors and independent solo auditors.
- Mix of accented English (auditor + auditee). Diarization quality drops sharply on heavy accents and code-switching; we want this in the data, not out of it.
- At least one engagement involving non-English questions or auditee replies.

## Recruitment channels

1. ISACA AIMS auditor LinkedIn group (warm intro via founder network).
2. UKAS / ANAB / DAkkS AIMS scheme listings (public).
3. AICPA AI Audit task force.
4. Two reach-outs to CB technical managers we already have introductions with.
5. Last-resort: paid recruitment via Respondent.io ($300/session for vetted lead auditors).

Compensation: 800 USD per pilot, paid after both sessions complete. Travel reimbursed for the in-person session if applicable.

NDAs: mutual NDA covering the auditee fixture data. AuditForge holds copyright on transcripts; auditors retain ownership of their feedback.

## Sessions

**Session 1 (90 min, video call) — synthetic interview**

- Pilot auditor interviews two AuditForge staffers role-playing an AIMS owner and an MLOps lead.
- Fixture script: 12 prompts mapped to A.5, A.6.2.7, A.7.4. Includes one deliberate contradiction and one deflection.
- AuditForge captures audio via the Live Interview composer.
- Pilot auditor sees the chat + right pane in real time, narrates pain points.
- Output: candidate findings stream, coverage tab snapshot, post-session NPS.

**Session 2 (90 min, in-person if local, otherwise video) — pilot auditor's own AIMS audit fragment**

- Pilot auditor uses Live Interview during a real AIMS audit fragment with their consenting client.
- Auditor controls capture (start/stop). All audio remains local; no cloud transmission unless auditor explicitly opts in for the cloud-LLM tier.
- Pilot auditor and AuditForge debrief jointly within 24 hours.

## Privacy & data handling (non-negotiable)

- Audio is captured to local disk only. Never uploaded.
- Transcripts are reviewed jointly with the pilot auditor and the auditee; either may demand deletion.
- We delete all pilot audio and transcripts within 30 days of pilot close. Telemetry (DER, WER, latency, NPS) is retained anonymised.
- Pilot data does NOT enter the v3 Phase 7.5 corpus unless the pilot auditor and auditee both sign the corpus contribution agreement.
- Any incident where data leaves the local device is a P0 stop-the-pilot event.

## Timeline

| Week | Activity |
|---|---|
| -3 | Recruitment outreach, NDAs, fixture script frozen |
| -2 | Internal dry run with two AuditForge staff |
| -1 | First two pilot auditors run Session 1 |
| 0 | Remaining three Session 1s |
| +1 | All five Session 2s |
| +2 | Joint debriefs, metric tabulation, go/no-go decision |
| +3 | If go: corpus contribution conversations; if no-go: triage and re-pilot plan |

## Decision gate

Phase 7.6 enables Live Interview composer if:

- DER median < 18%, p95 < 25%
- WER median < 12%
- Latency p95 < 3s local-medium tier
- ≥ 3 of 5 pilot auditors rate "kept up with live interview" ≥ 4 / 5
- Zero privacy incidents

Else: ship Phase 7.6 with Live Interview disabled by default, behind a per-engagement opt-in flag, and re-pilot with revised stack (e.g., NeMo diarization, Whisper Large v3 fine-tuned).

## Owner

Pilot lead: TBD. Co-owner: founder. Engineering escalation: Phase 7.6 tech lead.

## Open risks

- Five auditors is small. Treat as feasibility signal, not statistical sample.
- We don't yet have an audit-domain test set for diarization. Build one from Session 1 fixtures.
- Pyannote 3.1 has known issues with overlapping speech. Most audit interviews are turn-based; fixtures should test both turn-based and overlapping cases.
- Cloud-LLM opt-in adds a second consent surface that may slow the in-real-audit Session 2 — make the opt-in inline and reversible.
