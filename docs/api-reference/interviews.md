<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: interviews

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /v1/interviews`

**List interviews**

**Parameters**

_none_

**Responses**

- `200`: 

---

### `GET /v1/interviews/library`

**List curated interview library entries (filterable).**

**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `role` | query | yes | string |  |
| `clause` | query | yes | string |  |
| `mode` | query | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/interviews/plan`

**Compose a time-boxed interview plan from the library.**

**Parameters**

_none_

**Responses**

- `201`: 

---

### `GET /v1/interviews/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `PATCH /v1/interviews/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `DELETE /v1/interviews/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---
