<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: peer-review

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /v1/peer-review`

**List peer-review**

**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/peer-review`


**Parameters**

_none_

**Responses**

- `201`: 

---

### `GET /v1/peer-review/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `PATCH /v1/peer-review/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `DELETE /v1/peer-review/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `GET /v1/peer-review/{id}/comments`

**List comments on a peer-review package**

**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/peer-review/{id}/comments`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `201`: 

---

### `POST /v1/peer-review/{id}/comments/{commentId}/resolve`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |
| `commentId` | path | yes | string |  |

**Responses**

- `200`: 

---
