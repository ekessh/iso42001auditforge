// SPDX-License-Identifier: BUSL-1.1
import { Injectable, Logger } from '@nestjs/common';
import {
  StubDiarizationProvider,
  type DiarizationProvider,
} from '@auditforge/diarization';
import {
  InterviewSessionService,
  LiveInterviewComposer,
  type AttributionAdapter,
  type AttributionLite,
  type ComposerLedger,
  type ComposerLedgerEvent,
  type ConsentLookup,
  type InterviewSession,
  type NcDrafterAdapter,
} from '@auditforge/live-interview';
import {
  StubTranscriptionProvider,
  type TranscriptionProvider,
  type TranscriptSegment,
} from '@auditforge/transcription';
import type { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import type {
  CoverageDeltaDto,
  CoverageDeltaItemDto,
  InterviewSessionDto,
  InterviewTranscriptDto,
  StartInterviewDto,
} from './dto.js';

interface StoredSegment {
  readonly segment: TranscriptSegment;
  readonly speakerId: string;
  readonly attachedClauses: readonly { readonly clauseId: string; readonly confidence: number }[];
}

@Injectable()
export class InterviewsLiveService {
  private readonly logger = new Logger(InterviewsLiveService.name);
  private readonly sessions: InterviewSessionService;
  private readonly composer: LiveInterviewComposer;
  private readonly transcript = new Map<string, StoredSegment[]>();
  private readonly coverageDelta = new Map<string, CoverageDeltaItemDto[]>();
  private readonly providers: {
    transcription: TranscriptionProvider;
    diarization: DiarizationProvider;
  };

  constructor(private readonly engine: AuditEngineAdapter) {
    const consentLookup: ConsentLookup = {
      findActiveConsent: async (engagementId) => ({
        engagementId,
        grantedBy: 'auditor-self',
        grantedAt: new Date().toISOString(),
        method: 'electronic',
      }),
    };
    this.sessions = new InterviewSessionService(consentLookup);

    const ledger: ComposerLedger = {
      emit: (event: ComposerLedgerEvent) => this.emitLedger(event),
    };
    const attribution: AttributionAdapter = {
      attribute: async (input): Promise<readonly AttributionLite[]> => {
        const txt = input.text.toLowerCase();
        const out: AttributionLite[] = [];
        if (txt.includes('risk register')) {
          out.push({ clauseId: '6.1.2', confidence: 0.92 });
        }
        if (txt.includes('soa') || txt.includes('statement of applicability')) {
          out.push({ clauseId: 'A.1', confidence: 0.88 });
        }
        if (txt.includes('contradict')) {
          out.push({ clauseId: '4.1', confidence: 0.9, contradiction: true });
        }
        return out;
      },
    };
    const ncDrafter: NcDrafterAdapter = {
      draftFromGap: async (input) => {
        this.logger.debug(
          `nc-drafter trigger eng=${input.engagementId} clauses=${input.clauseIds.join(',')}`,
        );
      },
    };
    this.composer = new LiveInterviewComposer(attribution, ncDrafter, ledger);
    this.providers = {
      transcription: new StubTranscriptionProvider(),
      diarization: new StubDiarizationProvider(2),
    };
  }

  providersHandle(): {
    transcription: TranscriptionProvider;
    diarization: DiarizationProvider;
  } {
    return this.providers;
  }

  async start(firmId: string, dto: StartInterviewDto): Promise<InterviewSessionDto> {
    const session = await this.sessions.create({
      firmId,
      engagementId: dto.engagementId,
      title: dto.title,
      participants: dto.participants,
      airGapMode: dto.airGapMode,
      transcriptionProviderName: dto.transcriptionProviderName,
      diarizationProviderName: dto.diarizationProviderName,
    });
    const started = this.sessions.start(session.id);
    await this.composer.onSessionStart(started);
    this.transcript.set(started.id, []);
    this.coverageDelta.set(started.id, []);
    return this.toDto(started);
  }

  async end(firmId: string, id: string): Promise<InterviewSessionDto> {
    const s = this.requireSession(firmId, id);
    const ended = this.sessions.end(s.id);
    await this.composer.onSessionEnd(ended);
    return this.toDto(ended);
  }

  transcript_(firmId: string, id: string): InterviewTranscriptDto {
    const s = this.requireSession(firmId, id);
    const entries = this.transcript.get(s.id) ?? [];
    return {
      sessionId: s.id,
      segments: entries.map((e) => ({
        id: e.segment.id,
        startMs: e.segment.startMs,
        endMs: e.segment.endMs,
        text: e.segment.text,
        confidence: e.segment.confidence,
        speakerId: e.speakerId,
      })),
    };
  }

  coverage(firmId: string, id: string): CoverageDeltaDto {
    const s = this.requireSession(firmId, id);
    return {
      sessionId: s.id,
      newlyEvidencedClauses: this.coverageDelta.get(s.id) ?? [],
    };
  }

  async ingestSegment(input: {
    readonly firmId: string;
    readonly sessionId: string;
    readonly segment: TranscriptSegment;
    readonly speakerId: string;
  }): Promise<{
    readonly attached: readonly { readonly clauseId: string; readonly confidence: number }[];
    readonly contradiction: boolean;
  }> {
    const session = this.requireSession(input.firmId, input.sessionId);
    const result = await this.composer.onSegment({
      session,
      segment: input.segment,
      speakerId: input.speakerId,
    });
    const stored = this.transcript.get(session.id);
    if (stored) {
      stored.push({
        segment: input.segment,
        speakerId: input.speakerId,
        attachedClauses: result.attached.map((a) => ({
          clauseId: a.clauseId,
          confidence: a.confidence,
        })),
      });
    }
    const cov = this.coverageDelta.get(session.id);
    if (cov) {
      for (const a of result.attached) {
        if (!cov.find((c) => c.clauseId === a.clauseId)) {
          cov.push({
            clauseId: a.clauseId,
            confidence: a.confidence,
            segmentId: input.segment.id,
          });
        }
      }
    }
    return {
      attached: result.attached.map((a) => ({
        clauseId: a.clauseId,
        confidence: a.confidence,
      })),
      contradiction: result.contradiction,
    };
  }

  authorize(input: {
    readonly firmId: string;
    readonly sessionId: string;
    readonly auditorId: string;
  }):
    | { readonly allow: false; readonly reason: string; readonly code: number }
    | { readonly allow: true; readonly session: InterviewSession } {
    const s = this.sessions.get(input.sessionId);
    if (!s) return { allow: false, reason: 'session not found', code: 4404 };
    if (s.firmId !== input.firmId) return { allow: false, reason: 'firm mismatch', code: 4403 };
    if (s.status !== 'in_progress') {
      return { allow: false, reason: 'session not running', code: 4409 };
    }
    return { allow: true, session: s };
  }

  private requireSession(firmId: string, id: string): InterviewSession {
    const s = this.sessions.get(id);
    if (!s || s.firmId !== firmId) {
      throw new Error(`session ${id} not found`);
    }
    return s;
  }

  private toDto(s: InterviewSession): InterviewSessionDto {
    return {
      id: s.id,
      engagementId: s.engagementId,
      title: s.title,
      status: s.status,
      airGapMode: s.airGapMode,
      transcriptionProviderName: s.transcriptionProviderName,
      diarizationProviderName: s.diarizationProviderName,
      ...(s.startedAt !== undefined ? { startedAt: s.startedAt } : {}),
      ...(s.endedAt !== undefined ? { endedAt: s.endedAt } : {}),
    };
  }

  private async emitLedger(event: ComposerLedgerEvent): Promise<void> {
    try {
      await this.engine.append({
        firmId: 'system',
        engagementId: event.engagementId,
        actorId: 'system',
        type: event.name,
        entity: 'interview_session',
        entityId: event.sessionId,
        payload: event.payload,
      });
    } catch (err) {
      this.logger.warn(`ledger emit failed: ${(err as Error).message}`);
    }
  }
}
