<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: identity

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `POST /v1/identity/oidc/start`

**Begin OIDC authorization**

**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/identity/oidc/callback`


**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/identity/webauthn/register/start`


**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/identity/webauthn/register/finish`


**Parameters**

_none_

**Responses**

- `201`: 

---

### `POST /v1/identity/webauthn/login/start`


**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/identity/webauthn/login/finish`


**Parameters**

_none_

**Responses**

- `200`: 

---

### `POST /v1/identity/logout`

**Clear the session cookie (best-effort)**

**Parameters**

_none_

**Responses**

- `200`: 

---
