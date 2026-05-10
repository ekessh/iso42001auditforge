// SPDX-License-Identifier: BUSL-1.1
import {
  LiveInterviewError,
  type ConsentRecord,
  type InterviewSession,
  type Participant,
} from './types.js';

export interface ConsentLookup {
  findActiveConsent(engagementId: string): Promise<ConsentRecord | null>;
}

export interface CreateSessionInput {
  readonly firmId: string;
  readonly engagementId: string;
  readonly title: string;
  readonly participants: readonly Participant[];
  readonly airGapMode: boolean;
  readonly transcriptionProviderName: string;
  readonly diarizationProviderName: string;
}

export class InterviewSessionService {
  private readonly sessions = new Map<string, InterviewSession>();

  constructor(
    private readonly consent: ConsentLookup,
    private readonly idFactory: () => string = () =>
      `sess-${Math.random().toString(36).slice(2, 10)}`,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async create(input: CreateSessionInput): Promise<InterviewSession> {
    const consent = await this.consent.findActiveConsent(input.engagementId);
    if (!consent || consent.revokedAt) {
      throw new LiveInterviewError(
        'no active recording consent for this engagement',
        'CONSENT_MISSING',
      );
    }
    const id = this.idFactory();
    const speakerMap: Record<string, string> = {};
    for (const p of input.participants) {
      if (p.speakerId) speakerMap[p.speakerId] = p.auditorOrAuditeeId;
    }
    const session: InterviewSession = {
      id,
      firmId: input.firmId,
      engagementId: input.engagementId,
      title: input.title,
      status: 'scheduled',
      participants: [...input.participants],
      speakerMap,
      consent,
      airGapMode: input.airGapMode,
      transcriptionProviderName: input.transcriptionProviderName,
      diarizationProviderName: input.diarizationProviderName,
    };
    this.sessions.set(id, session);
    return session;
  }

  start(id: string): InterviewSession {
    const s = this.require(id);
    if (s.status !== 'scheduled') {
      throw new LiveInterviewError('session already started or ended', 'INVALID_STATE');
    }
    const next: InterviewSession = { ...s, status: 'in_progress', startedAt: this.clock() };
    this.sessions.set(id, next);
    return next;
  }

  end(id: string): InterviewSession {
    const s = this.require(id);
    if (s.status === 'ended' || s.status === 'archived') return s;
    const next: InterviewSession = { ...s, status: 'ended', endedAt: this.clock() };
    this.sessions.set(id, next);
    return next;
  }

  archive(id: string): InterviewSession {
    const s = this.require(id);
    const next: InterviewSession = { ...s, status: 'archived' };
    this.sessions.set(id, next);
    return next;
  }

  get(id: string): InterviewSession | null {
    return this.sessions.get(id) ?? null;
  }

  list(firmId: string): readonly InterviewSession[] {
    const out: InterviewSession[] = [];
    for (const s of this.sessions.values()) if (s.firmId === firmId) out.push(s);
    return out;
  }

  mapSpeakerToParticipant(session: InterviewSession, speakerId: string): string | null {
    return session.speakerMap[speakerId] ?? null;
  }

  private require(id: string): InterviewSession {
    const s = this.sessions.get(id);
    if (!s) throw new LiveInterviewError(`session ${id} not found`, 'NOT_FOUND');
    return s;
  }
}
