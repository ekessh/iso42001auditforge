// SPDX-License-Identifier: BUSL-1.1
'use client';
import Link from 'next/link';
import { listEngagements } from '@/lib/mocks/engagements';

export default function EngagementsPage() {
  const engagements = listEngagements();
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold">Engagements</h1>
      <table className="mt-6 w-full text-sm" aria-label="Engagements">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3">Client</th>
            <th className="py-2 pr-3">Stage</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3 tabular-nums">Man-days</th>
            <th className="py-2 pr-3 tabular-nums">WPs</th>
            <th className="py-2 pr-3 tabular-nums">Findings</th>
          </tr>
        </thead>
        <tbody>
          {engagements.map((e) => (
            <tr key={e.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
              <td className="py-2 pr-3">
                <Link href={`/engagements/${e.id}`} className="font-medium hover:underline">{e.clientName}</Link>
                <div className="text-xs text-slate-500 line-clamp-1">{e.scope}</div>
              </td>
              <td className="py-2 pr-3">{e.lifecycleStage}</td>
              <td className="py-2 pr-3">{e.status}</td>
              <td className="py-2 pr-3 tabular-nums">{e.manDaysSpent}/{e.manDaysPlanned}</td>
              <td className="py-2 pr-3 tabular-nums">{e.workingPapers.complete}/{e.workingPapers.total}</td>
              <td className="py-2 pr-3 tabular-nums">
                <span className="text-red-600">{e.openFindings.major}M</span>
                {' / '}
                <span className="text-amber-600">{e.openFindings.minor}m</span>
                {' / '}
                <span className="text-slate-500">{e.openFindings.ofi} OFI</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
