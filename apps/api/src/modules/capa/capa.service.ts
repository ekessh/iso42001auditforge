// SPDX-License-Identifier: BUSL-1.1
//
// CapaService — thin façade over `CapaRepository`. The package's
// `CapaWorkflow` (and SLA tracker / state machine) are exposed via the
// CapaAdapter; richer endpoints (propose/accept/verify/...) will route
// through the workflow when the API DTO surface grows to carry the
// CorrectiveAction shape.

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateCapaDto, UpdateCapaDto, CapaDto } from './dto.js';
import { CapaRepository } from './capa.repository.js';
import { CapaAdapter } from '../../adapters/capa.adapter.js';

@Injectable()
export class CapaService {
  constructor(
    private readonly repo: CapaRepository,
    @Optional() @Inject(CapaAdapter) private readonly adapter?: CapaAdapter,
  ) {}

  create(firmId: string, dto: CreateCapaDto): Promise<CapaDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<CapaDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: CapaDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateCapaDto): Promise<CapaDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to the CAPA workflow. Exposed for future endpoints. */
  workflow(): CapaAdapter['workflow'] | null {
    return this.adapter?.workflow ?? null;
  }
}
