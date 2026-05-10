<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: engagements

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /v1/engagements`

**List engagements (cursor paginated)**

**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/engagements`


**Parameters**

_none_

**Responses**

- `201`: 

---

### `GET /v1/engagements/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `PATCH /v1/engagements/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/engagements/{id}/transition`

**Transition engagement lifecycle state**

**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---
