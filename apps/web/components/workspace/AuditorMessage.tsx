// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * AuditorMessage — right-aligned chat bubble for what the auditor actually
 * asked or said. Includes interviewee dropdown to retarget the question.
 *
 * Per v3 §15.11 the auditor message is "right-aligned, distinct color, what
 * the auditor actually asked. Includes interviewee dropdown."
 */

import { ChevronDown } from 'lucide-react';
import * as React from 'react';

export interface AuditorMessageProps {
  body: string;
  ts: string;
  auditorName: string;
  intervieweeName: string;
  intervieweeRole?: string | undefined;
  /** Optional interviewee options for the dropdown. Mocked. */
  interviewees?: Array<{ id: string; name: string; role?: string }> | undefined;
  onChangeInterviewee?: ((id: string) => void) | undefined;
}

export function AuditorMessage({
  body,
  ts,
  auditorName,
  intervieweeName,
  intervieweeRole,
  interviewees,
  onChangeInterviewee,
}: AuditorMessageProps) {
  const [open, setOpen] = React.useState(false);
  const detailsRef = React.useRef<HTMLDetailsElement>(null);

  return (
    <article
      className="ml-auto max-w-[78ch] motion-safe:animate-slide-up"
      aria-label={`Auditor question by ${auditorName}, addressed to ${intervieweeName} at ${ts}`}
    >
      <div className="ml-auto inline-block rounded-2xl rounded-br-sm bg-info px-3.5 py-2.5 text-sm leading-relaxed text-info-foreground shadow-xs">
        {body}
      </div>
      <div className="mt-1 flex items-center justify-end gap-2 text-2xs text-muted-foreground">
        <span>{auditorName}</span>
        <span aria-hidden>·</span>
        <span className="sr-only">Addressed to </span>
        <span>to:</span>
        {interviewees && interviewees.length > 0 ? (
          <details
            ref={detailsRef}
            open={open}
            onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
            className="relative"
          >
            <summary
              className="list-none cursor-pointer inline-flex items-center gap-0.5 rounded px-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground"
              aria-haspopup="listbox"
            >
              {intervieweeName}
              {intervieweeRole ? <span className="text-muted-foreground">&nbsp;({intervieweeRole})</span> : null}
              <ChevronDown className="size-3" aria-hidden />
            </summary>
            <ul
              role="listbox"
              aria-label="Change interviewee"
              className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-md border border-border bg-popover p-1 shadow-md"
            >
              {interviewees.map((iv) => (
                <li key={iv.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={iv.name === intervieweeName}
                    onClick={() => {
                      onChangeInterviewee?.(iv.id);
                      setOpen(false);
                    }}
                    className="block w-full rounded px-2 py-1 text-left text-2xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {iv.name}
                    {iv.role ? <span className="text-muted-foreground">&nbsp;({iv.role})</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <span className="text-foreground">
            {intervieweeName}
            {intervieweeRole ? <span className="text-muted-foreground">&nbsp;({intervieweeRole})</span> : null}
          </span>
        )}
        <span aria-hidden>·</span>
        <time>{ts}</time>
      </div>
    </article>
  );
}
