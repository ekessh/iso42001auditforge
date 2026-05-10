<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: health

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `GET /healthz/live`


**Parameters**

_none_

**Responses**

- `200`: 

---

### `GET /healthz`


**Parameters**

_none_

**Responses**

- `200`: 

---

### `GET /healthz/ready`


**Parameters**

_none_

**Responses**

- `200`: 
- `503`: One or more downstream dependencies unreachable

---

### `GET /readyz`


**Parameters**

_none_

**Responses**

- `200`: 

---

### `GET /metrics`


**Parameters**

_none_

**Responses**

- `200`: 

---
