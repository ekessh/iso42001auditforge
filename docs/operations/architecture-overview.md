<!-- SPDX-License-Identifier: BUSL-1.1 -->
# AuditForge — Operations Architecture Overview

## Topology (single page)

```mermaid
flowchart LR
  subgraph Client[Auditor workstation]
    Web[Next.js web]
    Desktop[Tauri 2 desktop]
    Mobile[PWA]
  end

  subgraph Edge[Edge / TLS]
    ALB[ALB / cert-manager]
    WAF[AWS WAF]
  end

  subgraph K8s[Kubernetes — auditforge namespace]
    APIp[apps/api Deployment]
    Wkr[apps/worker Deployment]
    MCP[apps/mcp-server Deployment]
    Run[audit-evidence-runner]
    Asr[transcription-py]
    Vlm[vlm-py]
  end

  subgraph Data[Managed data plane]
    PG[(Postgres 16 + pgvector + RLS)]
    RD[(Redis 7)]
    S3[(S3 evidence/archive/reports — Object Lock COMPLIANCE)]
    Mlsr[(Meilisearch)]
    KMS[(KMS — wraps Ed25519 signing keys)]
  end

  subgraph LLM[LLM]
    Olm[Ollama / vLLM local default]
    CloudLLM[Cloud LLMs opt-in per engagement]
  end

  Client --> WAF --> ALB --> APIp
  ALB --> Web
  ALB --> MCP
  APIp --> PG
  APIp --> RD
  APIp --> S3
  APIp --> Mlsr
  APIp --> Olm
  APIp -. opt-in .-> CloudLLM
  Wkr --> Run
  APIp --> Asr
  APIp --> Vlm
  Wkr --> KMS
  APIp --> KMS
```

## Key invariants

- **Single-tenant data plane logical isolation:** Postgres RLS per engagement; defense in depth at app layer
- **Audit ledger is hash-chained + Ed25519 signed:** any tampering breaks verification
- **Local LLM default:** cloud LLMs opt-in per engagement, blocked at provider layer in air-gap mode
- **Receipt chain end-to-end:** every state transition produces a signed receipt stored in `./receipts/`
- **Auditor confirmation is the only state-transition trigger:** engines emit drafts only

## Layer ownership

| Layer                  | Owner             | Doc                       |
| ---------------------- | ----------------- | ------------------------- |
| Web frontend           | Frontend team     | `apps/web/README.md`      |
| API + worker           | Backend team      | `apps/api/README.md`      |
| LLM provider routing   | ML platform team  | `packages/llm-provider/`  |
| K8s + Helm             | Platform team     | `infra/helm/`             |
| Cloud baselines        | Platform team     | `infra/terraform/`        |
| Observability          | SRE team          | `docs/operations/monitoring.md` |
| Compliance evidence    | Security team     | `infra/runbooks/compliance-evidence-generation.md` |
