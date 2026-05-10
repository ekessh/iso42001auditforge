<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: developer-guide
audience: contributor
cross-refs:
  - docs/developer-guide/04-development-workflow.md
  - docs/developer-guide/05-testing-strategy.md
  - docs/adr/0001-modular-monolith.md
-->

# Adding a New Domain Module

> Step-by-step guide for adding a new functional domain to AuditForge,
> following the modular monolith pattern.

---

## When to Create a New Module

Create a new NestJS module when the domain is:

- **Bounded** — has its own entities, state machine, and lifecycle.
- **Isolated** — other modules communicate with it via a typed in-process
  event or service call, not direct DB access.
- **Testable independently** — has its own unit and integration test suite.

If the domain is too small (≤ 3 endpoints, ≤ 2 entities), consider
adding it to an existing related module instead.

---

## Step 1: Drizzle Schema

Add the schema to `packages/db/src/schema/<domain>.ts`:

```typescript
// SPDX-License-Identifier: BUSL-1.1
import { pgTable, uuid, text, timestamptz } from 'drizzle-orm/pg-core';

export const myDomainItems = pgTable('my_domain_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
});
```

Add a Drizzle migration:

```bash
pnpm --filter @auditforge/db db:generate
# Review the generated migration in packages/db/drizzle/0016_my_domain.sql
pnpm db:migrate
```

Add an RLS policy to the migration:

```sql
ALTER TABLE my_domain_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY my_domain_items_tenant_isolation ON my_domain_items
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

---

## Step 2: Repository (packages)

Create `packages/my-domain/src/my-domain.repository.ts`:

```typescript
// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { DrizzleService } from '@auditforge/db';
import { myDomainItems } from '@auditforge/db/schema';

@Injectable()
export class MyDomainRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findAll(tenantId: string) {
    return this.drizzle.db
      .select()
      .from(myDomainItems)
      .where(eq(myDomainItems.tenantId, tenantId));
  }
}
```

---

## Step 3: DTOs (packages/shared)

Add Zod schemas to `packages/shared/src/dto/my-domain.ts`:

```typescript
// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const CreateMyDomainItemDto = z.object({
  name: z.string().min(1).max(255),
});

export type CreateMyDomainItemDtoType = z.infer<typeof CreateMyDomainItemDto>;
```

---

## Step 4: NestJS Module

Create the module at `apps/api/src/modules/my-domain/`:

- `my-domain.module.ts` — NestJS module declaration.
- `my-domain.controller.ts` — REST controller with OpenAPI decorators.
- `my-domain.service.ts` — Business logic; emits audit ledger events.

```typescript
// my-domain.service.ts
// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { AuditLedgerService } from '@auditforge/audit-engine';
import { MyDomainRepository } from './my-domain.repository';

@Injectable()
export class MyDomainService {
  constructor(
    private readonly repo: MyDomainRepository,
    private readonly ledger: AuditLedgerService,
  ) {}

  async create(tenantId: string, dto: CreateMyDomainItemDtoType) {
    const item = await this.repo.create(tenantId, dto);
    await this.ledger.emit({
      type: 'my_domain.item_created',
      payload: { id: item.id },
      tenantId,
    });
    return item;
  }
}
```

Register the module in `apps/api/src/app.module.ts`.

---

## Step 5: React Hook (apps/web)

Add a TanStack Query hook to `apps/web/src/features/my-domain/`:

```typescript
// SPDX-License-Identifier: BUSL-1.1
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useMyDomainItems() {
  return useQuery({
    queryKey: ['my-domain-items'],
    queryFn: () => apiClient.get('/v1/my-domain').then(r => r.data),
  });
}
```

---

## Step 6: Page (apps/web)

Add a Next.js App Router page at
`apps/web/src/app/(audit)/my-domain/page.tsx`.

---

## Step 7: Tests

- Unit test the repository (with `FakeDB`) and the service.
- Integration test the controller.
- Add the new module to the e2e journey if it's user-facing.

Run `pnpm test:unit` and `pnpm test:integration` before raising the PR.

---

## Step 8: OpenAPI

```bash
pnpm --filter @auditforge/api gen:openapi
```

Verify the new endpoints appear in `apps/api/openapi/generated.json`.
Regenerate the API reference docs:

```bash
pnpm --filter @auditforge/scripts build-api-reference
```

---

## Cross-References

- [04-development-workflow.md](04-development-workflow.md) — PR gates.
- [07-adding-a-new-conformance-check.md](07-adding-a-new-conformance-check.md)
  — for probe-related domains.
- [ADR-0001](../adr/0001-modular-monolith.md) — module boundary rules.
