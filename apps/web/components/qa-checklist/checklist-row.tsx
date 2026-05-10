// SPDX-License-Identifier: BUSL-1.1
'use client';

import { CheckCircle2, MinusCircle, ShieldAlert, XCircle } from 'lucide-react';
import { Badge } from '@auditforge/ui-kit';
import type { ChecklistItem } from '@auditforge/api-client';

const STATUS_LABEL: Record<ChecklistItem['status'], string> = {
  pass: 'Pass',
  fail: 'Fail',
  overridden: 'Overridden',
  skipped: 'N/A',
};

export function ChecklistRow({
  item,
  onOverride,
}: {
  item: ChecklistItem;
  onOverride?: (itemId: string) => void;
}) {
  const tone =
    item.status === 'pass' || item.status === 'skipped'
      ? 'success'
      : item.status === 'overridden'
        ? 'warning'
        : 'danger';
  const Icon =
    item.status === 'pass'
      ? CheckCircle2
      : item.status === 'skipped'
        ? MinusCircle
        : item.status === 'overridden'
          ? ShieldAlert
          : XCircle;
  return (
    <li className="flex items-start gap-3 rounded border border-slate-200 dark:border-slate-800 p-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="grow">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{item.name}</h3>
          <Badge tone={tone} size="xs">
            {STATUS_LABEL[item.status]}
          </Badge>
        </div>
        {item.reason && <p className="mt-1 text-xs text-slate-500">{item.reason}</p>}
        {item.overrideRationale && (
          <p className="mt-1 text-xs italic text-slate-500">
            Override: {item.overrideRationale}
          </p>
        )}
      </div>
      {onOverride && item.status === 'fail' && (
        <button
          type="button"
          onClick={() => onOverride(item.id)}
          className="text-xs underline text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Override
        </button>
      )}
    </li>
  );
}
