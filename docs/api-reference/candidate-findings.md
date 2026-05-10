<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: candidate-findings

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /v1/engagements/{engagementId}/candidate-findings`

**List candidate findings drafted by the conversational engine**

**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `engagementId` | path | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/engagements/{engagementId}/candidate-findings/{cfId}/promote`

**Promote a candidate to a formal finding (auditor confirmation only)**

**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `engagementId` | path | yes | string |  |
| `cfId` | path | yes | string |  |

**Responses**

- `201`: 

---

### `POST /v1/engagements/{engagementId}/candidate-findings/{cfId}/dismiss`

**Dismiss a candidate finding with rationale**

**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `cfId` | path | yes | string |  |

**Responses**

- `200`: 

---
