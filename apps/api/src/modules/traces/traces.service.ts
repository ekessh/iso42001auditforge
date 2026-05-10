// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateTracesDto, UpdateTracesDto, TracesDto } from './dto.js';
import type { TracesRepository } from './traces.repository.js';
import { TraceAnalyzerAdapter } from '../../adapters/trace-analyzer.adapter.js';

@Injectable()
export class TracesService {
  constructor(
    private readonly repo: TracesRepository,
    @Optional() @Inject(TraceAnalyzerAdapter) private readonly adapter?: TraceAnalyzerAdapter,
  ) {}

  create(firmId: string, dto: CreateTracesDto): Promise<TracesDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<TracesDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: TracesDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateTracesDto): Promise<TracesDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  ingest(
    firmId: string,
    payload: { name: string; source?: string; spans?: unknown[]; metadata?: Record<string, unknown> },
  ): Promise<TracesDto> {
    return this.repo.ingest(firmId, payload);
  }

  /** Pass-through to TraceIngestor + TraceAnalyzer + AutonomyClassifier. */
  analyzer(): TraceAnalyzerAdapter | null {
    return this.adapter ?? null;
  }
}
