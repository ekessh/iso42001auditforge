<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: surveillance

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /v1/surveillance/clients/{id}/timeline`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: Surveillance timeline for a certified client

---

### `GET /v1/surveillance`

**List surveillance**

**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/surveillance`


**Parameters**

_none_

**Responses**

- `201`: 

---

### `GET /v1/surveillance/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `PATCH /v1/surveillance/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `DELETE /v1/surveillance/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---
