// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import type { TranscriptSegment } from '@auditforge/transcription';
import {
  LiveInterviewComposer,
  type AttributionAdapter,
  type AttributionLite,
  type ComposerLedger,
  type ComposerLedgerEvent,
  type NcDrafterAdapter,
} from '../src/composer.js';
import type { InterviewSession } from '../src/types.js';

const session: InterviewSession = {
  id: 'sess-1',
  firmId: 'firm-1',
  engagementId: 'eng-1',
  title: 'Risk',
  status: 'in_progress',
  participants: [
    { auditorOrAuditeeId: 'a', displayName: 'A', role: 'lead_auditor' },
  ],
  speakerMap: {},
  airGapMode: false,
  transcriptionProviderName: 'stub',
  diarizationProviderName: 'stub',
};

const segment: TranscriptSegment = {
  id: 'seg-1',
  startMs: 0,
  endMs: 100,
  text: 'We review our risk register quarterly.',
  isFinal: true,
  confidence: 0.95,
  words: [],
};

function buildLedger(): { ledger: ComposerLedger; events: ComposerLedgerEvent[] } {
  const events: ComposerLedgerEvent[] = [];
  return {
    events,
    ledger: {
      emit: async (e) => {
        events.push(e);
      },
    },
  };
}

function attribution(results: AttributionLite[]): AttributionAdapter {
  return { attribute: async () => results };
}

const noopDrafter: NcDrafterAdapter = { draftFromGap: async () => undefined };

describe('LiveInterviewComposer', () => {
  it('attaches high-confidence attributions to clauses', async () => {
    const { ledger, events } = buildLedger();
    const c = new LiveInterviewComposer(
      attribution([
        { clauseId: '6.1.2', confidence: 0.9 },
        { clauseId: '8.1', confidence: 0.5 },
      ]),
      noopDrafter,
      ledger,
    );
    const r = await c.onSegment({ session, segment, speakerId: 'SPK-A' });
    expect(r.attached.map((x) => x.clauseId)).toEqual(['6.1.2']);
    expect(r.unattributed).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe('interview.segment.recorded');
  });

  it('marks segment unattributed when no attribution clears threshold', async () => {
    const { ledger } = buildLedger();
    const c = new LiveInterviewComposer(
      attribution([{ clauseId: '6.1.2', confidence: 0.4 }]),
      noopDrafter,
      ledger,
    );
    const r = await c.onSegment({ session, segment, speakerId: 'SPK-A' });
    expect(r.unattributed).toBe(true);
  });

  it('triggers NC drafter on contradictions', async () => {
    const { ledger } = buildLedger();
    let called = 0;
    const drafter: NcDrafterAdapter = {
      draftFromGap: async () => {
        called += 1;
      },
    };
    const c = new LiveInterviewComposer(
      attribution([{ clauseId: '6.1.2', confidence: 0.9, contradiction: true }]),
      drafter,
      ledger,
    );
    const r = await c.onSegment({ session, segment, speakerId: 'SPK-A' });
    expect(r.contradiction).toBe(true);
    expect(called).toBe(1);
  });

  it('emits start/end/consent ledger events', async () => {
    const { ledger, events } = buildLedger();
    const c = new LiveInterviewComposer(attribution([]), noopDrafter, ledger);
    await c.onSessionStart(session);
    await c.onSessionEnd(session);
    await c.onConsentGranted({
      ...session,
      consent: {
        engagementId: 'eng-1',
        grantedBy: 'a',
        grantedAt: 'now',
        method: 'written',
      },
    });
    await c.onConsentRevoked(session);
    expect(events.map((e) => e.name)).toEqual([
      'interview.started',
      'interview.ended',
      'interview.consent.granted',
      'interview.consent.revoked',
    ]);
  });

  it('throws when recording into a non-running session', async () => {
    const { ledger } = buildLedger();
    const c = new LiveInterviewComposer(attribution([]), noopDrafter, ledger);
    await expect(
      c.onSegment({
        session: { ...session, status: 'scheduled' },
        segment,
        speakerId: 'SPK-A',
      }),
    ).rejects.toThrow();
  });

  it('rejects cloud transcription in air-gap mode', () => {
    const { ledger } = buildLedger();
    const c = new LiveInterviewComposer(attribution([]), noopDrafter, ledger);
    expect(() =>
      c.rejectCloudInAirGap({ ...session, airGapMode: true }, 'cloud'),
    ).toThrow();
    expect(() =>
      c.rejectCloudInAirGap({ ...session, airGapMode: true }, 'local'),
    ).not.toThrow();
  });
});
