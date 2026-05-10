<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Incident Response — Runbook

## Severity levels

| Sev | Definition                                                         | Page         | War-room |
| --- | ------------------------------------------------------------------ | ------------ | -------- |
| 1   | Customer-impacting outage / data integrity / signed-receipt break  | Immediate    | Yes      |
| 2   | Degraded SLO / partial feature outage                              | 15 min       | Yes      |
| 3   | Single-tenant impact / non-blocking bug                            | Business hrs | Optional |
| 4   | Cosmetic / observability gap                                       | Tracker      | No       |

## On-call flow

1. PagerDuty alert fires → primary on-call acknowledges in ≤ 5 min
2. Open war-room (Slack `#incident-{auto-id}` + Zoom bridge)
3. Designate Incident Commander, Communications Lead, Scribe
4. Run TRIAGE template (see below)
5. Mitigation deployed → monitor for 30 min → resolve
6. Postmortem within 5 business days (blameless template)

## TRIAGE template

- **What is broken?** (URL, service, SLO)
- **Blast radius?** (firms affected, % of requests)
- **What changed?** (recent deploys, infra ops, third-party)
- **Containment options?** (rollback, kill switch, scale, traffic shift)
- **Mitigation chosen + ETA**

## Communication template

```
[INCIDENT-{id}] {severity} — {summary}
Status: {investigating | identified | mitigating | monitoring | resolved}
Impact: {user-visible description}
Next update: {ISO timestamp}
```

## Escalation matrix

| Threshold                  | Escalate to             |
| -------------------------- | ----------------------- |
| Sev1 unmitigated > 30 min  | Engineering Director    |
| Sev1 unmitigated > 60 min  | CTO + Customer Success  |
| Data integrity event       | DPO + Legal             |
| Receipt-chain break        | DPO + Lead Auditor lead |

## Special: signed-receipt break

If the audit ledger receipt-chain validation fails:

1. Freeze writes (`kubectl scale deploy/auditforge-api --replicas=0`)
2. Snapshot Postgres + signing key envelope
3. Run `protect-mcp:audit-chain` skill against `./receipts/`
4. Engage Lead Auditor lead — this is a Sev1 with reputational exposure
5. Do NOT re-sign retroactively — chain integrity is paramount
