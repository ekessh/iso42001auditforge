// SPDX-License-Identifier: BUSL-1.1
import type { TranscriptSegment } from '@auditforge/transcription';
import type {
  CandidateAttachment,
  ComposerSegmentResult,
  InterviewSession,
} from './types.js';

export interface AttributionLite {
  readonly clauseId: string;
  readonly confidence: number;
  readonly contradiction?: boolean;
}

export interface AttributionAdapter {
  attribute(input: {
    readonly engagementId: string;
    readonly text: string;
    readonly speakerId: string;
  }): Promise<readonly AttributionLite[]>;
}

export interface NcDrafterAdapter {
  draftFromGap(input: {
    readonly engagementId: string;
    readonly clauseIds: readonly string[];
    readonly transcriptSegmentId: string;
    readonly note: string;
  }): Promise<void>;
}

export interface ComposerLedgerEvent {
  readonly name:
    | 'interview.started'
    | 'interview.ended'
    | 'interview.segment.recorded'
    | 'interview.consent.granted'
    | 'interview.consent.revoked';
  readonly engagementId: string;
  readonly sessionId: string;
  readonly at: string;
  readonly payload: Record<string, unknown>;
}

export interface ComposerLedger {
  emit(event: ComposerLedgerEvent): Promise<void>;
}

export const DEFAULT_HIGH_CONFIDENCE = 0.85;

export interface ComposerOptions {
  readonly highConfidenceThreshold?: number;
  readonly clock?: () => string;
}

export class LiveInterviewComposer {
  private readonly threshold: number;
  private readonly now: () => string;

  constructor(
    private readonly attribution: AttributionAdapter,
    private readonly ncDrafter: NcDrafterAdapter,
    private readonly ledger: ComposerLedger,
    opts: ComposerOptions = {},
  ) {
    this.threshold = opts.highConfidenceThreshold ?? DEFAULT_HIGH_CONFIDENCE;
    this.now = opts.clock ?? (() => new Date().toISOString());
  }

  async onSegment(input: {
    readonly session: InterviewSession;
    readonly segment: TranscriptSegment;
    readonly speakerId: string;
  }): Promise<ComposerSegmentResult> {
    if (input.session.status !== 'in_progress') {
      throw new Error(`cannot record segments for session in state ${input.session.status}`);
    }
    const attributions = await this.attribution.attribute({
      engagementId: input.session.engagementId,
      text: input.segment.text,
      speakerId: input.speakerId,
    });

    const attached: CandidateAttachment[] = [];
    let contradiction = false;
    for (const a of attributions) {
      if (a.contradiction) contradiction = true;
      if (a.confidence > this.threshold) {
        attached.push({
          clauseId: a.clauseId,
          confidence: a.confidence,
          source: 'attribution-engine',
          transcriptSegmentId: input.segment.id,
        });
      }
    }

    if (contradiction) {
      await this.ncDrafter.draftFromGap({
        engagementId: input.session.engagementId,
        clauseIds: attributions.map((x) => x.clauseId),
        transcriptSegmentId: input.segment.id,
        note: 'contradiction-detected-during-live-interview',
      });
    }

    await this.ledger.emit({
      name: 'interview.segment.recorded',
      engagementId: input.session.engagementId,
      sessionId: input.session.id,
      at: this.now(),
      payload: {
        segmentId: input.segment.id,
        speakerId: input.speakerId,
        attachedClauseCount: attached.length,
        contradiction,
        textLength: input.segment.text.length,
      },
    });

    return {
      segmentId: input.segment.id,
      attached,
      unattributed: attached.length === 0,
      contradiction,
    };
  }

  async onSessionStart(session: InterviewSession): Promise<void> {
    await this.ledger.emit({
      name: 'interview.started',
      engagementId: session.engagementId,
      sessionId: session.id,
      at: this.now(),
      payload: {
        airGapMode: session.airGapMode,
        transcriptionProvider: session.transcriptionProviderName,
        diarizationProvider: session.diarizationProviderName,
        participantCount: session.participants.length,
      },
    });
  }

  async onSessionEnd(session: InterviewSession): Promise<void> {
    await this.ledger.emit({
      name: 'interview.ended',
      engagementId: session.engagementId,
      sessionId: session.id,
      at: this.now(),
      payload: { startedAt: session.startedAt ?? null, endedAt: session.endedAt ?? null },
    });
  }

  async onConsentGranted(session: InterviewSession): Promise<void> {
    await this.ledger.emit({
      name: 'interview.consent.granted',
      engagementId: session.engagementId,
      sessionId: session.id,
      at: this.now(),
      payload: { method: session.consent?.method ?? 'unknown' },
    });
  }

  async onConsentRevoked(session: InterviewSession): Promise<void> {
    await this.ledger.emit({
      name: 'interview.consent.revoked',
      engagementId: session.engagementId,
      sessionId: session.id,
      at: this.now(),
      payload: {},
    });
  }

  rejectCloudInAirGap(
    session: InterviewSession,
    providerKind: 'cloud' | 'local',
  ): void {
    if (session.airGapMode && providerKind === 'cloud') {
      throw new Error('air-gap mode forbids cloud transcription provider');
    }
  }
}
