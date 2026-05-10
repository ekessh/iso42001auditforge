// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { InterviewSessionService, type ConsentLookup } from '../src/session.js';
import { LiveInterviewError, type ConsentRecord } from '../src/types.js';

const ACTIVE: ConsentRecord = {
  engagementId: 'eng-1',
  grantedBy: 'user-1',
  grantedAt: '2026-05-10T00:00:00Z',
  method: 'written',
};

function consent(active: ConsentRecord | null): ConsentLookup {
  return {
    findActiveConsent: async () => active,
  };
}

const baseInput = {
  firmId: 'firm-1',
  engagementId: 'eng-1',
  title: 'Risk owner interview',
  participants: [
    { auditorOrAuditeeId: 'a1', displayName: 'Alice', role: 'lead_auditor' as const },
    { auditorOrAuditeeId: 'b1', displayName: 'Bob', role: 'risk_officer' as const },
  ],
  airGapMode: false,
  transcriptionProviderName: 'stub',
  diarizationProviderName: 'stub',
};

describe('InterviewSessionService', () => {
  it('blocks creation without active consent', async () => {
    const svc = new InterviewSessionService(consent(null));
    await expect(svc.create(baseInput)).rejects.toBeInstanceOf(LiveInterviewError);
  });

  it('blocks when consent is revoked', async () => {
    const svc = new InterviewSessionService(
      consent({ ...ACTIVE, revokedAt: '2026-05-10T00:01:00Z' }),
    );
    await expect(svc.create(baseInput)).rejects.toBeInstanceOf(LiveInterviewError);
  });

  it('creates and lifecycles a session', async () => {
    let counter = 0;
    const svc = new InterviewSessionService(
      consent(ACTIVE),
      () => `s-${++counter}`,
      () => '2026-05-10T01:00:00Z',
    );
    const s = await svc.create(baseInput);
    expect(s.id).toBe('s-1');
    expect(s.status).toBe('scheduled');
    const started = svc.start(s.id);
    expect(started.status).toBe('in_progress');
    expect(started.startedAt).toBe('2026-05-10T01:00:00Z');
    const ended = svc.end(s.id);
    expect(ended.status).toBe('ended');
    const archived = svc.archive(s.id);
    expect(archived.status).toBe('archived');
  });

  it('rejects double-start', async () => {
    const svc = new InterviewSessionService(consent(ACTIVE));
    const s = await svc.create(baseInput);
    svc.start(s.id);
    expect(() => svc.start(s.id)).toThrow();
  });

  it('throws on unknown ids', () => {
    const svc = new InterviewSessionService(consent(ACTIVE));
    expect(() => svc.start('nope')).toThrow();
    expect(svc.get('nope')).toBeNull();
  });

  it('lists per firm', async () => {
    const svc = new InterviewSessionService(consent(ACTIVE));
    await svc.create(baseInput);
    await svc.create({ ...baseInput, firmId: 'firm-2' });
    expect(svc.list('firm-1')).toHaveLength(1);
  });

  it('builds a speaker map from participants', async () => {
    const svc = new InterviewSessionService(consent(ACTIVE));
    const s = await svc.create({
      ...baseInput,
      participants: [
        {
          auditorOrAuditeeId: 'a1',
          displayName: 'Alice',
          role: 'lead_auditor',
          speakerId: 'SPK-A',
        },
      ],
    });
    expect(svc.mapSpeakerToParticipant(s, 'SPK-A')).toBe('a1');
    expect(svc.mapSpeakerToParticipant(s, 'SPK-Z')).toBeNull();
  });

  it('end is idempotent on already-ended', async () => {
    const svc = new InterviewSessionService(consent(ACTIVE));
    const s = await svc.create(baseInput);
    svc.start(s.id);
    svc.end(s.id);
    expect(svc.end(s.id).status).toBe('ended');
  });
});
