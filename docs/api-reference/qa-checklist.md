<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference: qa-checklist

> Auto-generated from `apps/api/openapi/generated.json`.
> Re-generate with `npx tsx scripts/build-api-reference.ts`.

**Related concepts**: see [../concepts/](../concepts/) for domain documentation.

### `POST /v1/qa-checklist/evaluate`

**Evaluate the QA checklist for a draft report; returns deterministic { passed, items }.**

**Parameters**

_none_

**Responses**

- `201`: 

---

### `POST /v1/qa-checklist/override`

**Lead-auditor override for a single failed checklist item. Rationale is logged to the audit ledger.**

**Parameters**

_none_

**Responses**

- `200`: 

---
