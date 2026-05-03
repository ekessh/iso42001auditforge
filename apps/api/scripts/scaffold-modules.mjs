// SPDX-License-Identifier: BUSL-1.1
// One-shot scaffolder used at repo bootstrap. Re-running is idempotent — it
// will not overwrite existing files. Hand-written modules (identity, engagements,
// reports, probes, working-papers, evidence-vault, findings, audit-ledger,
// health, admin) are skipped.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.resolve(__dirname, '..', 'src', 'modules');

const HAND_WRITTEN = new Set([
  'identity', 'engagements', 'reports', 'probes', 'working-papers',
  'evidence-vault', 'findings', 'audit-ledger', 'health', 'admin',
]);

const MODULES = [
  { name: 'identity', resource: 'identity' },
  { name: 'tenancy', resource: 'tenancy' },
  { name: 'clients', resource: 'clients' },
  { name: 'engagements', resource: 'engagements' },
  { name: 'audit-plans', resource: 'audit-plans' },
  { name: 'ai-systems', resource: 'ai-systems' },
  { name: 'agent-workflows', resource: 'agent-workflows' },
  { name: 'working-papers', resource: 'working-papers' },
  { name: 'evidence-vault', resource: 'evidence-vault' },
  { name: 'samples', resource: 'samples' },
  { name: 'interviews', resource: 'interviews' },
  { name: 'probes', resource: 'probes' },
  { name: 'traces', resource: 'traces' },
  { name: 'findings', resource: 'findings' },
  { name: 'capa', resource: 'capa' },
  { name: 'soa', resource: 'soa' },
  { name: 'risks', resource: 'risks' },
  { name: 'cross-framework', resource: 'cross-framework' },
  { name: 'reports', resource: 'reports' },
  { name: 'peer-review', resource: 'peer-review' },
  { name: 'archive', resource: 'archive' },
  { name: 'co-auditor', resource: 'co-auditor' },
  { name: 'surveillance', resource: 'surveillance' },
  { name: 'billing', resource: 'billing' },
  { name: 'audit-ledger', resource: 'audit-ledger' },
  { name: 'health', resource: 'health' },
  { name: 'admin', resource: 'admin' },
];

function pascal(name) {
  return name.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
}

function camel(name) {
  const p = pascal(name);
  return p[0].toLowerCase() + p.slice(1);
}

async function ensureFile(file, content) {
  try { await fs.access(file); return false; } catch {}
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
  return true;
}

function dto(name) {
  const Pn = pascal(name);
  return `// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const Create${Pn}Schema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type Create${Pn}Dto = z.infer<typeof Create${Pn}Schema>;

export const Update${Pn}Schema = Create${Pn}Schema.partial();
export type Update${Pn}Dto = z.infer<typeof Update${Pn}Schema>;

export class ${Pn}Dto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class ${Pn}PageDto {
  @ApiProperty({ type: [${Pn}Dto] }) items!: ${Pn}Dto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
`;
}

function repo(name) {
  const Pn = pascal(name);
  return `// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import type { ${Pn}Dto, Create${Pn}Dto, Update${Pn}Dto } from './dto.js';

@Injectable()
export class ${Pn}Repository extends BaseRepository {
  private readonly memory = new Map<string, ${Pn}Dto>();

  async create(firmId: string, dto: Create${Pn}Dto): Promise<${Pn}Dto> {
    const now = new Date().toISOString();
    const row: ${Pn}Dto = { id: randomUUID(), firmId, name: dto.name, metadata: dto.metadata, createdAt: now, updatedAt: now };
    this.memory.set(row.id, row);
    return row;
  }

  async findById(firmId: string, id: string): Promise<${Pn}Dto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('${Pn}', id);
    return r;
  }

  async list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: ${Pn}Dto[]; nextCursor: string | null }> {
    const all = Array.from(this.memory.values()).filter((r) => r.firmId === firmId);
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next = startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }

  async update(firmId: string, id: string, dto: Update${Pn}Dto): Promise<${Pn}Dto> {
    const cur = await this.findById(firmId, id);
    const updated: ${Pn}Dto = { ...cur, ...dto, updatedAt: new Date().toISOString() };
    this.memory.set(id, updated);
    return updated;
  }

  async remove(firmId: string, id: string): Promise<void> {
    await this.findById(firmId, id);
    this.memory.delete(id);
  }
}
`;
}

function service(name) {
  const Pn = pascal(name);
  return `// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { Create${Pn}Dto, Update${Pn}Dto, ${Pn}Dto } from './dto.js';
import { ${Pn}Repository } from './${name}.repository.js';

@Injectable()
export class ${Pn}Service {
  constructor(private readonly repo: ${Pn}Repository) {}

  create(firmId: string, dto: Create${Pn}Dto): Promise<${Pn}Dto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<${Pn}Dto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: ${Pn}Dto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: Update${Pn}Dto): Promise<${Pn}Dto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
`;
}

function controller(name, resource) {
  const Pn = pascal(name);
  const camelN = camel(name);
  return `// SPDX-License-Identifier: BUSL-1.1
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UsePipes, Req,
} from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Rbac } from '../../common/rbac.guard.js';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CursorPageQuerySchema } from '../../common/pagination.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { Create${Pn}Schema, Update${Pn}Schema, type Create${Pn}Dto, type Update${Pn}Dto, ${Pn}Dto, ${Pn}PageDto } from './dto.js';
import { ${Pn}Service } from './${name}.service.js';

@ApiTags('${resource}')
@Controller({ path: '${resource}', version: '1' })
export class ${Pn}Controller {
  constructor(private readonly svc: ${Pn}Service) {}

  @Get()
  @Rbac('${resource}', 'read')
  @ApiOperation({ summary: 'List ${resource}' })
  @ApiOkResponse({ type: ${Pn}PageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<${Pn}PageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { cursor: q.cursor, limit: q.limit });
  }

  @Get(':id')
  @Rbac('${resource}', 'read')
  @ApiOkResponse({ type: ${Pn}Dto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<${Pn}Dto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('${resource}', 'create')
  @AuditTrail({ type: '${resource}.created', entity: '${resource}' })
  @UsePipes(new ZodValidationPipe(Create${Pn}Schema))
  @ApiCreatedResponse({ type: ${Pn}Dto })
  async create(@Req() req: FastifyRequest, @Body() body: Create${Pn}Dto): Promise<${Pn}Dto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('${resource}', 'update')
  @AuditTrail({ type: '${resource}.updated', entity: '${resource}', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(Update${Pn}Schema))
  @ApiOkResponse({ type: ${Pn}Dto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: Update${Pn}Dto): Promise<${Pn}Dto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('${resource}', 'delete')
  @AuditTrail({ type: '${resource}.deleted', entity: '${resource}', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
`;
}

function moduleFile(name) {
  const Pn = pascal(name);
  return `// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { ${Pn}Controller } from './${name}.controller.js';
import { ${Pn}Service } from './${name}.service.js';
import { ${Pn}Repository } from './${name}.repository.js';

@Module({
  controllers: [${Pn}Controller],
  providers: [${Pn}Service, ${Pn}Repository],
  exports: [${Pn}Service],
})
export class ${Pn}Module {}
`;
}

function spec(name) {
  const Pn = pascal(name);
  return `// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';
import { ${Pn}Service } from './${name}.service.js';
import { ${Pn}Repository } from './${name}.repository.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';

describe('${Pn}Service', () => {
  let svc: ${Pn}Service;
  const firmA = '11111111-1111-1111-1111-111111111111';
  const firmB = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    const sql = (() => Promise.resolve()) as unknown as Parameters<typeof Reflect.construct>[1];
    // BaseRepository requires sql + tenancy; in unit tests we skip actual DB
    const repo = new ${Pn}Repository(sql as never, new TenancyAdapter());
    svc = new ${Pn}Service(repo);
  });

  function withCtx(firmId: string, fn: () => Promise<unknown>): Promise<unknown> {
    return RequestContextStore.run(
      { requestId: 'r', firmId, auditorId: 'a', roles: ['lead_auditor'] },
      fn,
    );
  }

  it('creates and reads back', async () => {
    await withCtx(firmA, async () => {
      const created = await svc.create(firmA, { name: 'sample' });
      expect(created.firmId).toBe(firmA);
      const got = await svc.get(firmA, created.id);
      expect(got.id).toBe(created.id);
    });
  });

  it('isolates by firm', async () => {
    let id = '';
    await withCtx(firmA, async () => {
      const r = await svc.create(firmA, { name: 'a' });
      id = r.id;
    });
    await withCtx(firmB, async () => {
      await expect(svc.get(firmB, id)).rejects.toThrow();
    });
  });

  it('updates fields', async () => {
    await withCtx(firmA, async () => {
      const c = await svc.create(firmA, { name: 'old' });
      const u = await svc.update(firmA, c.id, { name: 'new' });
      expect(u.name).toBe('new');
    });
  });

  it('lists with pagination', async () => {
    await withCtx(firmA, async () => {
      for (let i = 0; i < 3; i += 1) await svc.create(firmA, { name: 'i' + i });
      const page = await svc.list(firmA, { limit: 2 });
      expect(page.items.length).toBe(2);
    });
  });

  it('removes', async () => {
    await withCtx(firmA, async () => {
      const c = await svc.create(firmA, { name: 'gone' });
      await svc.remove(firmA, c.id);
      await expect(svc.get(firmA, c.id)).rejects.toThrow();
    });
  });
});
`;
}

let created = 0;
let skipped = 0;

for (const m of MODULES) {
  if (HAND_WRITTEN.has(m.name)) continue;
  const dir = path.join(MODULES_DIR, m.name);
  const wroteAny = (await Promise.all([
    ensureFile(path.join(dir, 'dto.ts'), dto(m.name)),
    ensureFile(path.join(dir, `${m.name}.repository.ts`), repo(m.name)),
    ensureFile(path.join(dir, `${m.name}.service.ts`), service(m.name)),
    ensureFile(path.join(dir, `${m.name}.controller.ts`), controller(m.name, m.resource)),
    ensureFile(path.join(dir, `${m.name}.module.ts`), moduleFile(m.name)),
    ensureFile(path.join(dir, `${m.name}.service.spec.ts`), spec(m.name)),
  ])).some(Boolean);
  if (wroteAny) created += 1; else skipped += 1;
}

console.log(`scaffolded modules: ${created}, skipped: ${skipped}`);
