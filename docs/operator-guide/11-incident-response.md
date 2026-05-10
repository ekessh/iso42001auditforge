<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Incident Response

> Operator-specific severity matrix and first-response actions.
> Cross-reference: `infra/runbooks/incident-response.md` for detailed
> runbook procedures.

---

## Severity Matrix

| Severity | Criteria | Response time | Examples |
|---|---|---|---|
| **SEV-1 (Critical)** | Service unavailable for all users OR data loss OR ledger chain corruption | 15 minutes | API pod crash-looping; Postgres unreachable; chain verify returns errors |
| **SEV-2 (High)** | Significant degradation for multiple users OR security event | 1 hour | Evidence extraction failing; TSA unavailable > 2 hours; suspected unauthorized access |
| **SEV-3 (Medium)** | Single function degraded; workaround available | 4 hours | Meilisearch down (search unavailable but core audit works); PDF render queue backed up |
| **SEV-4 (Low)** | Minor issue; no impact on ongoing audits | Next business day | Stale Grafana dashboard data; non-critical log noise |

---

## SEV-1 First Response

1. **Alert the on-call operator** via PagerDuty / OpsGenie (configure
   alertmanager routes in `infra/observability/alertmanager.yaml`).
2. **Check pod status**:
   ```bash
   kubectl get pods -n auditforge
   kubectl describe pod <crashing-pod> -n auditforge
   kubectl logs <crashing-pod> -n auditforge --previous
   ```
3. **Check Postgres connectivity**:
   ```bash
   kubectl exec -n auditforge deploy/auditforge-api -- \
     psql $DATABASE_URL -c "SELECT 1"
   ```
4. **Check chain integrity** (if ledger events may have been corrupted):
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://auditforge.example.com/v1/admin/chain/verify-all
   ```
5. If chain integrity fails: **stop all write traffic immediately**.
   Put the API into read-only mode by setting the `READ_ONLY=true` env
   var and restarting. Escalate to the security team.
6. Refer to `infra/runbooks/incident-response.md` for the full
   procedure.

---

## Security Incident Response

If a security incident is suspected (unauthorized access, data
exfiltration, compromised signing key):

1. **Rotate the signing key immediately** — see
   [09-secrets-and-key-rotation.md](09-secrets-and-key-rotation.md).
   Even if no events were forged, a compromised key undermines the
   chain's trust.
2. **Preserve logs** — do not restart pods until logs are captured.
   Export Pino logs from the current and previous pod generations.
3. **Revoke active sessions** by rotating `SESSION_SECRET`.
4. **Notify affected firms** per the SECURITY.md disclosure policy.
5. File an incident report including: timeline, affected tenants, data
   categories exposed, remediation steps.

---

## Communicating with Auditors During an Incident

Auditors mid-engagement who hit errors should:

1. Not lose working paper edits — Yjs IndexedDB preserves local state.
2. Be informed of the estimated resolution time via the status page or
   direct communication.
3. Not sign reports during a SEV-1 incident (report signing requires
   TSA connectivity and ledger write access).

Provide auditors with the incident ID and estimated restoration time.
See [../auditor-guide/15-incidents-and-rollback.md](../auditor-guide/15-incidents-and-rollback.md).

---

## Post-Incident Review

For SEV-1 and SEV-2 incidents, conduct a blameless post-mortem within
48 hours:

- Timeline of events.
- Root cause analysis.
- Action items with owners and due dates.
- Any changes to alert thresholds or runbooks.

Publish the post-mortem summary to the status page.

---

## Related Documents

- `infra/runbooks/incident-response.md` — detailed step-by-step runbook.
- [09-secrets-and-key-rotation.md](09-secrets-and-key-rotation.md) —
  key rotation on compromise.
- [07-monitoring-and-alerting.md](07-monitoring-and-alerting.md) —
  alert configuration.
