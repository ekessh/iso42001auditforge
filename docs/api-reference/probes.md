<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: probes

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /v1/probes`


**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/probes`


**Parameters**

_none_

**Responses**

- `201`: 

---

### `GET /v1/probes/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/probes/{id}/execute`

**Queue a probe execution**

**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `201`: 

---

### `GET /v1/probes/executions/list`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `engagementId` | query | yes | string |  |

**Responses**

- `200`: 

---

### `GET /v1/probes/executions/{executionId}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `executionId` | path | yes | string |  |

**Responses**

- `200`: 

---

### `GET /v1/probes/budget/{engagementId}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `engagementId` | path | yes | string |  |

**Responses**

- `200`: 

---
