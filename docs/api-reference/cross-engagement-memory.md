<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: cross-engagement-memory

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /v1/cross-engagement-memory`

**Query anonymized per-firm cross-engagement patterns. Read-only; lead-auditor consumption surface.**

**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/cross-engagement-memory/aggregate/{engagementId}`

**Trigger pattern aggregation for a closed engagement. Anonymizer enforced; emits cross-engagement-memory.aggregated.**

**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `engagementId` | path | yes | string |  |

**Responses**

- `200`: 

---
