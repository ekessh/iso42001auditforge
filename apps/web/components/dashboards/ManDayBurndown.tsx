// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * ManDayBurndown — time elapsed vs planned man-day burn-down per v3 §15.14.
 *
 * Two lines: planned (target slope) and actual. If actual diverges below
 * planned past the current day, the engine emits a "time overrun" risk
 * indicator (rendered separately by the dashboard).
 */

import * as React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ManDayPoint } from '@/lib/mocks/workspace-mock';

export interface ManDayBurndownProps {
  points: ManDayPoint[];
  spent: number;
  planned: number;
}

export function ManDayBurndown({ points, spent, planned }: ManDayBurndownProps) {
  const pct = Math.round((spent / Math.max(1, planned)) * 100);
  return (
    <section
      aria-labelledby="manday-burndown"
      className="rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <header className="flex items-center justify-between">
        <h2
          id="manday-burndown"
          className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Man-day burn-down
        </h2>
        <span className="text-2xs tabular-nums text-muted-foreground">
          <b className="text-foreground">{spent}</b>/{planned} ({pct}%)
        </span>
      </header>
      <div className="mt-3 h-44 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--af-border-rgb, rgba(148,163,184,0.18))" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="currentColor" tickFormatter={(d) => `D${d}`} />
            <YAxis tick={{ fontSize: 10 }} stroke="currentColor" />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                background: 'rgb(var(--af-popover))',
                color: 'rgb(var(--af-popover-fg))',
                border: '1px solid rgb(var(--af-border))',
                borderRadius: 6,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="planned" name="Planned" stroke="rgb(var(--af-muted-fg))" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="rgb(var(--af-info))" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>Planned vs actual man-day expenditure per audit day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Planned</th>
            <th>Actual</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <td>D{p.day}</td>
              <td>{p.planned}</td>
              <td>{p.actual}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
