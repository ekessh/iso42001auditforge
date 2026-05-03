// SPDX-License-Identifier: BUSL-1.1
import type { EngagementContext } from '../domain/tenant.js';

export interface BM25Hit {
  claimId: string;
  score: number;
}

export interface BM25Adapter {
  search(
    ctx: EngagementContext,
    query: string,
    limit: number,
  ): Promise<BM25Hit[]>;
}

export interface VectorHit {
  claimId: string;
  score: number;
}

export interface VectorAdapter {
  embed(text: string): Promise<number[]>;
  search(
    ctx: EngagementContext,
    embedding: number[],
    limit: number,
  ): Promise<VectorHit[]>;
}

export interface LedgerSink {
  emitEpisodeAppended(ctx: EngagementContext, episodeId: string): Promise<void>;
  emitClaimCreated(ctx: EngagementContext, claimId: string): Promise<void>;
  emitClaimInvalidated(
    ctx: EngagementContext,
    claimId: string,
    reason: string,
  ): Promise<void>;
  emitClaimSuperseded(
    ctx: EngagementContext,
    oldClaimId: string,
    newClaimId: string,
  ): Promise<void>;
}

export class NoopLedgerSink implements LedgerSink {
  async emitEpisodeAppended(): Promise<void> {}
  async emitClaimCreated(): Promise<void> {}
  async emitClaimInvalidated(): Promise<void> {}
  async emitClaimSuperseded(): Promise<void> {}
}
