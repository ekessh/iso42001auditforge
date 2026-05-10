// SPDX-License-Identifier: BUSL-1.1

import type { EventQuery, EventRepository, LedgerEvent } from './ledger.js';

export interface Projection<TState> {
  readonly name: string;
  readonly initial: () => TState;
  reduce(state: TState, event: LedgerEvent): TState;
}

export interface ProjectionCheckpoint {
  readonly projectionName: string;
  readonly firmId: string;
  readonly lastSequence: number;
}

export interface ProjectionStore {
  loadCheckpoint(projectionName: string, firmId: string): Promise<ProjectionCheckpoint | null>;
  saveCheckpoint(cp: ProjectionCheckpoint): Promise<void>;
  reset(projectionName: string, firmId: string): Promise<void>;
}

export class InMemoryProjectionStore implements ProjectionStore {
  private readonly map = new Map<string, ProjectionCheckpoint>();
  private key(p: string, f: string): string { return `${p}::${f}`; }
  async loadCheckpoint(projectionName: string, firmId: string): Promise<ProjectionCheckpoint | null> {
    return this.map.get(this.key(projectionName, firmId)) ?? null;
  }
  async saveCheckpoint(cp: ProjectionCheckpoint): Promise<void> {
    this.map.set(this.key(cp.projectionName, cp.firmId), cp);
  }
  async reset(projectionName: string, firmId: string): Promise<void> {
    this.map.delete(this.key(projectionName, firmId));
  }
}

export class ProjectionService {
  constructor(
    private readonly repo: EventRepository,
    private readonly store: ProjectionStore = new InMemoryProjectionStore(),
  ) {}

  async build<TState>(
    proj: Projection<TState>,
    query: EventQuery,
  ): Promise<{ state: TState; lastSequence: number }> {
    const events = await this.repo.list({ ...query });
    let state = proj.initial();
    let last = 0;
    for (const e of events) {
      state = proj.reduce(state, e);
      last = e.sequenceNumber;
    }
    return { state, lastSequence: last };
  }

  async rebuild<TState>(
    proj: Projection<TState>,
    query: EventQuery,
  ): Promise<{ state: TState; lastSequence: number }> {
    await this.store.reset(proj.name, query.firmId);
    const result = await this.build(proj, query);
    await this.store.saveCheckpoint({
      projectionName: proj.name,
      firmId: query.firmId,
      lastSequence: result.lastSequence,
    });
    return result;
  }

  async catchUp<TState>(
    proj: Projection<TState>,
    query: EventQuery,
    seedState: TState,
  ): Promise<{ state: TState; lastSequence: number }> {
    const cp = await this.store.loadCheckpoint(proj.name, query.firmId);
    const fromSeq = (cp?.lastSequence ?? 0) + 1;
    const events = await this.repo.list({ ...query, fromSequence: fromSeq });
    let state = seedState;
    let last = cp?.lastSequence ?? 0;
    for (const e of events) {
      state = proj.reduce(state, e);
      last = e.sequenceNumber;
    }
    if (last > (cp?.lastSequence ?? 0)) {
      await this.store.saveCheckpoint({
        projectionName: proj.name,
        firmId: query.firmId,
        lastSequence: last,
      });
    }
    return { state, lastSequence: last };
  }
}
