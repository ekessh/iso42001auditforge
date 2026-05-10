<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: findings

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /v1/findings`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `engagementId` | query | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/findings`


**Parameters**

_none_

**Responses**

- `201`: 

---

### `GET /v1/findings/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `PATCH /v1/findings/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/findings/{id}/transition`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---
