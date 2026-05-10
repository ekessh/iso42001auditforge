<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: interviews-live

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `POST /v1/interviews`

**Start a live interview session.**

**Parameters**

_none_

**Responses**

- `201`: 

---

### `PATCH /v1/interviews/{id}/end`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `GET /v1/interviews/{id}/transcript`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `GET /v1/interviews/{id}/coverage-delta`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---
