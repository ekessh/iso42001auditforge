// SPDX-License-Identifier: BUSL-1.1

export interface MockEngagement {
  id: string;
  clientName: string;
  scope: string;
  lifecycleStage: 'S1' | 'S2' | 'Surv1' | 'Surv2' | 'Recert';
  startDate: string;
  endDate: string;
  status: 'planning' | 'in_progress' | 'reporting' | 'closed';
  manDaysPlanned: number;
  manDaysSpent: number;
  openFindings: { major: number; minor: number; ofi: number };
  aiSystems: number;
  workingPapers: { total: number; complete: number };
  probesRun: number;
  tracesIngested: number;
}

const FIXTURES: Record<string, MockEngagement> = {
  'eng-001': {
    id: 'eng-001',
    clientName: 'Atlas Diagnostics Inc.',
    scope: 'AI Management System covering clinical decision support, radiology triage, and drug-discovery RAG agents',
    lifecycleStage: 'S2',
    startDate: '2026-04-15',
    endDate: '2026-05-23',
    status: 'in_progress',
    manDaysPlanned: 18,
    manDaysSpent: 11,
    openFindings: { major: 1, minor: 4, ofi: 7 },
    aiSystems: 12,
    workingPapers: { total: 47, complete: 31 },
    probesRun: 84,
    tracesIngested: 1421,
  },
  'eng-002': {
    id: 'eng-002',
    clientName: 'Northwind Capital Markets',
    scope: 'AIMS for trading model lifecycle, fairness monitoring, and customer-facing assistants',
    lifecycleStage: 'Surv1',
    startDate: '2026-05-10',
    endDate: '2026-05-14',
    status: 'planning',
    manDaysPlanned: 5,
    manDaysSpent: 0,
    openFindings: { major: 0, minor: 2, ofi: 3 },
    aiSystems: 7,
    workingPapers: { total: 22, complete: 0 },
    probesRun: 0,
    tracesIngested: 0,
  },
};

export function mockEngagement(id: string): MockEngagement {
  return FIXTURES[id] ?? FIXTURES['eng-001']!;
}

export function listEngagements(): MockEngagement[] {
  return Object.values(FIXTURES);
}
