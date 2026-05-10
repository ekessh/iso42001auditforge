// SPDX-License-Identifier: BUSL-1.1
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  CommitDebouncer,
  SyncRoomState,
  type SyncCommitEvent,
  WS_FORBIDDEN,
  WS_NOT_FOUND,
  type AuthDecision,
} from '@auditforge/working-papers';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { WorkingPapersSyncRepository } from './working-papers-sync.repository.js';

interface ActiveRoom {
  state: SyncRoomState;
  firmId: string;
  engagementId: string;
  workingPaperId: string;
  participants: Set<string>;
  lastActivity: number;
}

@Injectable()
export class WorkingPapersSyncService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkingPapersSyncService.name);
  private readonly rooms = new Map<string, ActiveRoom>();
  private readonly debouncer: CommitDebouncer;

  constructor(
    private readonly repo: WorkingPapersSyncRepository,
    private readonly audit: AuditEngineAdapter,
  ) {
    this.debouncer = new CommitDebouncer({
      intervalMs: 5_000,
      emit: (e) => this.emitCommit(e),
    });
  }

  async authorize(opts: {
    firmId: string;
    auditorId: string;
    workingPaperId: string;
    canWrite: boolean;
  }): Promise<AuthDecision> {
    if (!opts.canWrite) {
      return { allow: false, code: WS_FORBIDDEN, reason: 'missing working_paper.update' };
    }
    const wp = await this.repo.loadEngagementForWp(opts.firmId, opts.workingPaperId);
    if (!wp) {
      return { allow: false, code: WS_NOT_FOUND, reason: 'working paper not found' };
    }
    return {
      allow: true,
      auditor: {
        firmId: opts.firmId,
        engagementId: wp.engagementId,
        auditorId: opts.auditorId,
        displayName: opts.auditorId,
      },
    };
  }

  async ensureRoom(opts: {
    workingPaperId: string;
    firmId: string;
    engagementId: string;
  }): Promise<ActiveRoom> {
    const existing = this.rooms.get(opts.workingPaperId);
    if (existing) return existing;
    const snapshot = await this.repo.loadSnapshot(opts.firmId, opts.workingPaperId);
    const updates = await this.repo.loadUpdatesAfter(
      opts.firmId,
      opts.workingPaperId,
      null,
    );
    const state = new SyncRoomState(snapshot ?? null);
    for (const u of updates) state.applyClientUpdate(u, 'startup');
    const room: ActiveRoom = {
      state,
      firmId: opts.firmId,
      engagementId: opts.engagementId,
      workingPaperId: opts.workingPaperId,
      participants: new Set(),
      lastActivity: Date.now(),
    };
    this.rooms.set(opts.workingPaperId, room);
    return room;
  }

  async ingestUpdate(opts: {
    workingPaperId: string;
    update: Uint8Array;
    auditorId: string;
  }): Promise<{ contentHash: string; engagementId: string }> {
    const room = this.rooms.get(opts.workingPaperId);
    if (!room) throw new Error('room not active');
    room.state.applyClientUpdate(opts.update, opts.auditorId);
    room.lastActivity = Date.now();
    await this.repo.appendUpdate({
      firmId: room.firmId,
      engagementId: room.engagementId,
      workingPaperId: room.workingPaperId,
      update: opts.update,
      auditorId: opts.auditorId,
    });
    const snapshot = room.state.serializeSnapshot();
    this.debouncer.schedule({
      workingPaperId: room.workingPaperId,
      firmId: room.firmId,
      engagementId: room.engagementId,
      auditorId: opts.auditorId,
      contentHash: snapshot.contentHash,
      occurredAt: new Date().toISOString(),
    });
    return { contentHash: snapshot.contentHash, engagementId: room.engagementId };
  }

  async releaseRoomIfEmpty(workingPaperId: string): Promise<void> {
    const room = this.rooms.get(workingPaperId);
    if (!room) return;
    if (room.participants.size > 0) return;
    const snapshot = room.state.serializeSnapshot();
    await this.repo.upsertSnapshot({
      firmId: room.firmId,
      engagementId: room.engagementId,
      workingPaperId,
      snapshot,
    });
    this.debouncer.flush(workingPaperId);
    this.rooms.delete(workingPaperId);
  }

  trackParticipant(workingPaperId: string, sessionId: string): void {
    const room = this.rooms.get(workingPaperId);
    if (!room) return;
    room.participants.add(sessionId);
  }

  untrackParticipant(workingPaperId: string, sessionId: string): void {
    const room = this.rooms.get(workingPaperId);
    if (!room) return;
    room.participants.delete(sessionId);
  }

  participantCount(workingPaperId: string): number {
    return this.rooms.get(workingPaperId)?.participants.size ?? 0;
  }

  /** Used by the snapshot/compaction job. */
  listActiveRooms(): readonly { workingPaperId: string; firmId: string; engagementId: string }[] {
    return [...this.rooms.values()].map((r) => ({
      workingPaperId: r.workingPaperId,
      firmId: r.firmId,
      engagementId: r.engagementId,
    }));
  }

  async snapshotRoom(workingPaperId: string): Promise<void> {
    const room = this.rooms.get(workingPaperId);
    if (!room) return;
    const snapshot = room.state.serializeSnapshot();
    await this.repo.upsertSnapshot({
      firmId: room.firmId,
      engagementId: room.engagementId,
      workingPaperId,
      snapshot,
    });
  }

  private async emitCommit(event: SyncCommitEvent): Promise<void> {
    try {
      await this.audit.append({
        firmId: event.firmId,
        engagementId: event.engagementId,
        actorId: event.auditorId,
        type: 'wp.updated',
        entity: 'working-paper',
        entityId: event.workingPaperId,
        payload: {
          contentHash: event.contentHash,
          via: 'sync',
          occurredAt: event.occurredAt,
        },
      });
    } catch (err) {
      this.logger.error({ err }, 'wp sync ledger emission failed');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.debouncer.flushAll();
    for (const id of [...this.rooms.keys()]) {
      try {
        await this.snapshotRoom(id);
      } catch (err) {
        this.logger.error({ err, id }, 'failed snapshot on shutdown');
      }
    }
    this.rooms.clear();
  }
}
