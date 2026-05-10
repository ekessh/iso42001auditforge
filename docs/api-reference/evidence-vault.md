<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: evidence-vault

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `POST /v1/evidence/uploads/presign`

**Get a presigned URL for direct browser upload**

**Parameters**

_none_

**Responses**

- `201`: 

---

### `POST /v1/evidence/uploads/finalize`


**Parameters**

_none_

**Responses**

- `201`: 

---

### `GET /v1/evidence`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `engagementId` | query | yes | string |  |

**Responses**

- `200`: 

---

### `GET /v1/evidence/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/evidence/{id}/download-url`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---
