// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { InterviewsLiveService } from './interviews-live.service.js';

function svc(): InterviewsLiveService {
  return new InterviewsLiveService(new AuditEngineAdapter());
}

const baseStart = {
  engagementId: 'eng-1',
  title: 'Risk owner',
  participants: [
    {
      auditorOrAuditeeId: 'a',
      displayName: 'A',
      role: 'lead_auditor' as const,
      speakerId: 'SPK-A',
    },
  ],
  airGapMode: true,
  transcriptionProviderName: 'stub',
  diarizationProviderName: 'stub',
};

describe('InterviewsLiveService', () => {
  it('starts and ends a session', async () => {
    const s = svc();
    const session = await s.start('firm-1', baseStart);
    expect(session.status).toBe('in_progress');
    const ended = await s.end('firm-1', session.id);
    expect(ended.status).toBe('ended');
  });

  it('ingests segments and tracks coverage delta on high-confidence attribution', async () => {
    const s = svc();
    const session = await s.start('firm-1', baseStart);
    const r = await s.ingestSegment({
      firmId: 'firm-1',
      sessionId: session.id,
      segment: {
        id: 'seg-1',
        startMs: 0,
        endMs: 100,
        text: 'we keep a risk register up-to-date',
        confidence: 0.95,
        isFinal: true,
        words: [],
      },
      speakerId: 'SPK-A',
    });
    expect(r.attached.find((a) => a.clauseId === '6.1.2')).toBeTruthy();
    const coverage = s.coverage('firm-1', session.id);
    expect(coverage.newlyEvidencedClauses).toHaveLength(1);
    const transcript = s.transcript_('firm-1', session.id);
    expect(transcript.segments).toHaveLength(1);
  });

  it('authorize rejects unknown sessions', () => {
    const s = svc();
    const decision = s.authorize({
      firmId: 'firm-1',
      sessionId: 'nope',
      auditorId: 'a',
    });
    expect(decision.allow).toBe(false);
  });

  it('authorize rejects firm mismatch', async () => {
    const s = svc();
    const session = await s.start('firm-1', baseStart);
    const decision = s.authorize({
      firmId: 'other-firm',
      sessionId: session.id,
      auditorId: 'a',
    });
    expect(decision.allow).toBe(false);
  });
});
