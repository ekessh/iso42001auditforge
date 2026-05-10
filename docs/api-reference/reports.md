<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: reports

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /v1/reports`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `engagementId` | query | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/reports`


**Parameters**

_none_

**Responses**

- `201`: 

---

### `GET /v1/reports/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `PATCH /v1/reports/{id}`


**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---

### `POST /v1/reports/{id}/render`

**Queue PDF rendering**

**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `201`: 

---

### `POST /v1/reports/{id}/sign`

**Sign and issue report (WebAuthn-attested)**

**Parameters**

| Name | In | Required | Type | Description |
|---|---|---|---|---|
| `id` | path | yes | string |  |

**Responses**

- `200`: 

---
