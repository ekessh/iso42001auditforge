// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * ReadinessTrendChart — readiness % over time per v3 §15.14.
 *
 * Annotated with significant events (audit closures, NC closures, scope
 * changes). Recharts is used for parity with v2 dashboards.
 *
 * The chart renders `aria-hidden` for sighted-only context and is
 * accompanied by a visually-hidden table for assistive tech.
 */

import * as React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ReadinessTrendPoint } from '@/lib/mocks/workspace-mock';

export interface ReadinessTrendChartProps {
  points: ReadinessTrendPoint[];
}

export function ReadinessTrendChart({ points }: ReadinessTrendChartProps) {
  return (
    <section aria-labelledby="readiness-trend" className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <header className="flex items-center justify-between">
        <h2
          id="readiness-trend"
          className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Readiness trend
        </h2>
        <span className="text-2xs text-muted-foreground">last 90 days</span>
      </header>
      <div className="mt-3 h-48 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--af-border-rgb, rgba(148,163,184,0.18))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis
              dataKey="readinessPct"
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                background: 'rgb(var(--af-popover))',
                color: 'rgb(var(--af-popover-fg))',
                border: '1px solid rgb(var(--af-border))',
                borderRadius: 6,
              }}
              labelStyle={{ color: 'rgb(var(--af-muted-fg))' }}
              formatter={(value: number) => [`${value}%`, 'Readiness']}
            />
            <Line
              type="monotone"
              dataKey="readinessPct"
              stroke="rgb(var(--af-success))"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {points
              .filter((p) => p.event)
              .map((p) => (
                <ReferenceDot
                  key={p.date}
                  x={p.date}
                  y={p.readinessPct}
                  r={3}
                  fill="rgb(var(--af-info))"
                  stroke="rgb(var(--af-info))"
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Visually-hidden tabular fallback for assistive tech */}
      <table className="sr-only">
        <caption>Readiness trend per fortnightly snapshot</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Readiness %</th>
            <th>Event</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{p.date}</td>
              <td>{p.readinessPct}</td>
              <td>{p.event ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="mt-2 flex flex-wrap gap-3 text-2xs text-muted-foreground">
        {points
          .filter((p) => p.event)
          .map((p) => (
            <li key={p.date} className="inline-flex items-center gap-1">
              <span aria-hidden className="size-1.5 rounded-full bg-info" />
              <span className="font-mono">{p.date}</span> — {p.event}
            </li>
          ))}
      </ul>
    </section>
  );
}
