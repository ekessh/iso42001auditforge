<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: traces

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /v1/traces`

**List traces**

**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/traces`


**Parameters**

_none_

**Responses**

- `201`: 

---

### `GET /v1/traces/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `PATCH /v1/traces/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `DELETE /v1/traces/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/traces/ingest`

**Ingest a raw trace dump (OTel/Langfuse/Phoenix)**

**Parameters**

_none_

**Request body**

Content-Type: `application/json`

object

**Responses**

- `201`: 

---
