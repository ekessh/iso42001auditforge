// SPDX-License-Identifier: BUSL-1.1
'use client';

interface Props {
  onAccept: () => void;
  onReject: () => void;
}

export function ConsentBanner({ onAccept, onReject }: Props) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      aria-describedby="consent-body"
      className="rounded-md border border-amber-300 bg-amber-50 p-4 shadow-sm"
    >
      <h2 id="consent-title" className="text-sm font-semibold text-amber-900">
        Recording consent required
      </h2>
      <p id="consent-body" className="mt-1 text-sm text-amber-900">
        ISO 42001 audits require written and recorded consent before transcription
        begins. Confirm the auditee has granted recording consent for this engagement.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          Consent granted — start session
        </button>
        <button
          type="button"
          onClick={onReject}
          className="rounded border border-border bg-background px-3 py-1 text-sm font-medium hover:bg-muted/50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
