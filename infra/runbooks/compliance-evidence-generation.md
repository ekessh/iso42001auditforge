<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Compliance Evidence Generation — Runbook

AuditForge eats its own dogfood: it profiles itself in its own AI System Inventory.
This runbook describes how to extract evidence from a deployed system to support
SOC 2 / ISO 27001 / ISO 42001 audits **of the AuditForge platform itself**.

## Evidence types

| Standard         | Control area            | AuditForge artifact                          |
| ---------------- | ----------------------- | -------------------------------------------- |
| SOC 2 CC6        | Logical access          | `audit_ledger.access_*` events               |
| SOC 2 CC7        | Change management       | Signed deploy receipts in receipts/          |
| SOC 2 CC8        | Change tracking         | Helm release history + Terraform state       |
| ISO 27001 A.9    | Access control          | RBAC export + WebAuthn audit                 |
| ISO 27001 A.12.4 | Logging                 | Loki retention + audit ledger export         |
| ISO 27001 A.18.1 | Compliance              | Catalogue snapshots + change logs            |
| ISO 42001 6.1    | AI risk management      | AI System Inventory export                   |
| ISO 42001 8.2    | AI system impact assess | Engagement records (anonymized)              |

## Generation procedure

```sh
# 1. Date range
PERIOD_START=2026-04-01
PERIOD_END=2026-05-01

# 2. Audit ledger export (signed)
pnpm --filter @auditforge/archive export \
  --kind audit-ledger --since $PERIOD_START --until $PERIOD_END \
  --output evidence/audit-ledger.tar.zst

# 3. Access review export
pnpm --filter @auditforge/auth-core access-review \
  --since $PERIOD_START --output evidence/access-review.csv

# 4. Change log export (Terraform state diffs + Helm releases)
git log --since=$PERIOD_START --until=$PERIOD_END \
  --pretty=format:'%h %an %ad %s' -- infra/ > evidence/change-log.txt
helm history auditforge -n auditforge -o yaml > evidence/helm-history.yaml

# 5. Receipt chain verification
pnpm --filter @auditforge/signing verify-chain \
  --since $PERIOD_START --output evidence/chain-verification.json

# 6. AI System Inventory export
pnpm --filter @auditforge/ai-system-profiler export-self \
  --output evidence/ai-system-inventory.json

# 7. Bundle and sign
tar c evidence/ | zstd -19 > evidence-$PERIOD_START-$PERIOD_END.tar.zst
cosign sign-blob --key auditforge-release.key \
  evidence-$PERIOD_START-$PERIOD_END.tar.zst > evidence-$PERIOD_START-$PERIOD_END.sig
```

## Hand-off to external auditor

- Bundle + signature delivered via secure file-transfer (cosign-verifiable)
- Auditor verifies signature against `auditforge-release.pub`
- Auditor inspects receipt chain — any break means evidence rejection
- Q&A handled via the engagement workflow (auditee-facing portal disabled)
