<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: samples

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /v1/samples`

**List samples**

**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/samples`


**Parameters**

_none_

**Responses**

- `201`: 

---

### `GET /v1/samples/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `PATCH /v1/samples/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `DELETE /v1/samples/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/samples/draw`

**Draw a deterministic sample from a population.**

**Parameters**

_none_

**Responses**

- `201`: 

---

### `POST /v1/samples/override`

**Swap a sampled unit for cause; rationale is logged to the ledger.**

**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/samples/calculate-size`

**Compute textbook attribute / variable / MUS sample size.**

**Parameters**

_none_

**Responses**

- `200`: 

---
