// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import {
  ClaimGraph,
  CompactionWorker,
  ContradictionDetector,
  EpisodeStore,
  HybridRetrievalOrchestrator,
  PointInTimeQuery,
  SchemaRegistry,
  SystemIdFactory,
  mutableClock,
} from '../src/index.js';
import { InMemoryAuditMemoryStore } from '../src/adapters/in-memory-store.js';
import { NoopLedgerSink } from '../src/adapters/retrieval.js';
import type {
  BM25Adapter,
  BM25Hit,
  EngagementContext,
  ExtractionAdapter,
  ExtractionResult,
  LedgerSink,
  VectorAdapter,
  VectorHit,
} from '../src/index.js';
import type { Episode } from '../src/domain/episode.js';
import type { SchemaVersion } from '../src/domain/schema-version.js';
import type { Claim } from '../src/domain/claim.js';

export interface Harness {
  ctx: EngagementContext;
  altCtx: EngagementContext;
  store: InMemoryAuditMemoryStore;
  ledger: LedgerSink;
  clock: ReturnType<typeof mutableClock>;
  episodeStore: EpisodeStore;
  schemaRegistry: SchemaRegistry;
  claimGraph: ClaimGraph;
  contradictionDetector: ContradictionDetector;
  pointInTime: PointInTimeQuery;
  buildHybridRetrieval(deps: {
    bm25: BM25Adapter;
    vector: VectorAdapter;
  }): HybridRetrievalOrchestrator;
  buildCompactionWorker(deps: {
    extractor: ExtractionAdapter;
    archiveAfterDays?: number;
  }): CompactionWorker;
  freshSchema(): Promise<SchemaVersion>;
}

export function createHarness(initialIso = '2030-01-01T00:00:00.000Z'): Harness {
  const store = new InMemoryAuditMemoryStore();
  const ledger = new NoopLedgerSink();
  const clock = mutableClock(initialIso);
  const ids = SystemIdFactory;
  const ctx: EngagementContext = {
    firmId: randomUUID(),
    engagementId: randomUUID(),
  };
  const altCtx: EngagementContext = {
    firmId: ctx.firmId,
    engagementId: randomUUID(),
  };

  const schemaRegistry = new SchemaRegistry({ store, clock, ids });
  const episodeStore = new EpisodeStore({ store, ledger, clock, ids });
  const claimGraph = new ClaimGraph({
    store,
    ledger,
    clock,
    ids,
    schemaRegistry,
  });
  const contradictionDetector = new ContradictionDetector({ store });
  const pointInTime = new PointInTimeQuery({ store });

  return {
    ctx,
    altCtx,
    store,
    ledger,
    clock,
    episodeStore,
    schemaRegistry,
    claimGraph,
    contradictionDetector,
    pointInTime,
    buildHybridRetrieval({ bm25, vector }) {
      return new HybridRetrievalOrchestrator({
        store,
        bm25,
        vector,
        graph: claimGraph,
        clock,
        ids,
      });
    },
    buildCompactionWorker({ extractor, archiveAfterDays = 90 }) {
      return new CompactionWorker({
        store,
        extractor,
        clock,
        ids,
        claimGraph,
        schemaRegistry,
        archiveAfterDays,
      });
    },
    async freshSchema() {
      const v = await schemaRegistry.createInitialVersion(ctx);
      return schemaRegistry.freezeVersion(ctx, v.id);
    },
  };
}

export class StaticBM25Adapter implements BM25Adapter {
  constructor(private readonly hits: BM25Hit[]) {}
  async search(): Promise<BM25Hit[]> {
    return this.hits.map((h) => ({ ...h }));
  }
}

export class StaticVectorAdapter implements VectorAdapter {
  constructor(
    private readonly embedding: number[],
    private readonly hits: VectorHit[],
  ) {}
  async embed(): Promise<number[]> {
    return [...this.embedding];
  }
  async search(): Promise<VectorHit[]> {
    return this.hits.map((h) => ({ ...h }));
  }
}

export interface MockExtractorBehavior {
  claims?: Claim[];
  rejections?: { reason: string; raw: unknown }[];
  modelInvocationId?: string;
}

export class MockExtractor implements ExtractionAdapter {
  public lastEpisode: Episode | null = null;
  constructor(private readonly behavior: MockExtractorBehavior) {}
  async extract(episode: Episode): Promise<ExtractionResult> {
    this.lastEpisode = episode;
    return {
      claims: this.behavior.claims ?? [],
      rejections: this.behavior.rejections ?? [],
      modelInvocationId: this.behavior.modelInvocationId ?? randomUUID(),
    };
  }
}

export function buildClaim(
  ctx: EngagementContext,
  schema: SchemaVersion,
  overrides: Partial<Claim> = {},
): Claim {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    firmId: ctx.firmId,
    engagementId: ctx.engagementId,
    schemaVersionId: schema.id,
    entityType: 'AISystem',
    subject: 'AISystem:default',
    predicate: 'covers',
    object: 'Clause:6.1.2',
    evidenceEpisodeIds: [],
    extractedBy: { modelName: 'mock-1', modelInvocationId: randomUUID() },
    eventTimeStart: '2030-01-01T00:00:00.000Z',
    eventTimeEnd: null,
    ingestionTime: '2030-01-01T00:00:00.000Z',
    validity: 'active',
    embedding: null,
    ...overrides,
  };
}
