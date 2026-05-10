<!-- SPDX-License-Identifier: BUSL-1.1 -->
# AuditForge — Cost Model

All numbers are list price as of 2026-Q2 us-east-1. Reservations / Savings Plans
typically cut compute 30–50% — apply per env.

## Dev (single firm, single region, no HA)

| Component                    | Type                 | Monthly USD |
| ---------------------------- | -------------------- | ----------- |
| EKS control plane            | -                    | 73          |
| Node group: 2× t3.large      | EC2                  | 120         |
| RDS Postgres db.t4g.medium   | Single-AZ, 50 GB gp3 | 80          |
| ElastiCache cache.t4g.small  | Single node          | 25          |
| S3 (~100 GB)                 | Standard + Glacier IR| 5           |
| Data transfer / NAT          | Estimated            | 30          |
| Logs (CloudWatch + Loki)     | -                    | 25          |
| **Total**                    |                      | **~360**    |

## Staging (HA, single region, no GPU)

| Component                    | Type                       | Monthly USD |
| ---------------------------- | -------------------------- | ----------- |
| EKS control plane            | -                          | 73          |
| Node group: 3× m6i.large     | EC2                        | 320         |
| RDS Postgres db.r6g.large    | Multi-AZ, 100 GB gp3, 14d  | 480         |
| ElastiCache cache.r7g.large  | 2 nodes, multi-AZ          | 320         |
| S3 (~500 GB) + Object Lock   |                            | 25          |
| KMS (CMKs + ops)             |                            | 10          |
| NAT × 3                      |                            | 100         |
| Logs (90d retention)         |                            | 80          |
| **Total**                    |                            | **~1,400**  |

## Prod (multi-AZ HA, GPU for transcription/vlm, 90d backup)

| Component                              | Type                                   | Monthly USD |
| -------------------------------------- | -------------------------------------- | ----------- |
| EKS control plane                      | -                                      | 73          |
| Node group: 6× m6i.xlarge (CPU)        | EC2                                    | 1,200       |
| GPU node group: 2× g5.xlarge           | EC2                                    | 1,500       |
| RDS Postgres db.r6g.2xlarge            | Multi-AZ, 500 GB gp3, 90d backups      | 2,800       |
| ElastiCache cache.r7g.xlarge ×3        | Multi-AZ                               | 950         |
| S3 (~5 TB Standard + 10 TB Glacier IR) | Object Lock COMPLIANCE                 | 250         |
| KMS                                    | Multi-region key + ops                 | 30          |
| NAT × 3                                |                                        | 100         |
| GuardDuty + CloudTrail                 |                                        | 90          |
| Logs (90d retention)                   |                                        | 250         |
| ALB / WAF                              |                                        | 80          |
| **Sub-total**                          |                                        | **~7,300**  |
| Cross-region DR (cold)                 | RDS read replica + standby S3 CRR      | 800         |
| **Total**                              |                                        | **~8,100**  |

## Air-gap vs cloud-LLM cost delta

Cloud LLM (per engagement, ~50 hours auditor time, ~100k tokens/hour):

- Anthropic Claude 4.7 Sonnet: 5,000,000 tokens × $3/MTok in + $15/MTok out (assume 70/30 split) ≈ $33 per engagement
- Anthropic Claude 4.7 Opus: same volume ≈ $165 per engagement
- OpenAI GPT-4.1: similar to Sonnet
- For 100 engagements/month: $3,300 (Sonnet baseline) — $16,500 (Opus heavy)

Air-gap (Ollama on existing GPU node group): $0 marginal (GPU sunk cost in node
group; throughput satisfies routine engagements without contention).

Break-even: cloud LLM is cheaper for low-volume firms (< 5 engagements/mo);
air-gap pays back at moderate volume even ignoring confidentiality value.

## Per-firm scaling

Linear from staging up to ~50 firms; superlinear thereafter due to GPU
fanout for transcription/vlm. Plan for `cost_per_firm_per_month ≈ $80` at
prod-class deployment with 100 firms.
