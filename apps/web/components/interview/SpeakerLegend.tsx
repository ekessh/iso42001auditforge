// SPDX-License-Identifier: BUSL-1.1
'use client';

interface Props {
  speakers: { id: string; label: string }[];
  current: string | null;
}

export function SpeakerLegend({ speakers, current }: Props) {
  return (
    <aside
      aria-label="Speaker legend"
      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
    >
      <span className="text-xs font-semibold text-muted-foreground">Speakers</span>
      {speakers.map((s) => (
        <span
          key={s.id}
          aria-current={current === s.id ? 'true' : undefined}
          className={`rounded-full border px-2 py-0.5 text-xs ${
            current === s.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-border'
          }`}
        >
          {s.id}: {s.label}
        </span>
      ))}
    </aside>
  );
}
