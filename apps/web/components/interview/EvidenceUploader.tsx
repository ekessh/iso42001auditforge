// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useCallback, useState } from 'react';
import { evidenceExtraction } from '@auditforge/api-client';

interface Props {
  engagementId?: string;
  defaultSchema?: evidenceExtraction.ExtractionSchemaId;
}

const SCHEMAS: evidenceExtraction.ExtractionSchemaId[] = [
  'ModelCard',
  'Datasheet',
  'FairnessReport',
  'IncidentLog',
];

export function EvidenceUploader({ engagementId, defaultSchema = 'ModelCard' }: Props) {
  const [schemaId, setSchemaId] =
    useState<evidenceExtraction.ExtractionSchemaId>(defaultSchema);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<evidenceExtraction.ExtractedField | null>(null);

  const onFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const base64 = bufferToBase64(buf);
        const out = await evidenceExtraction.extractEvidence({
          schemaId,
          imageBase64: base64,
          imageMimeType: file.type || 'image/png',
          ...(engagementId ? { engagementId } : {}),
        });
        setResult(out);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [engagementId, schemaId],
  );

  return (
    <section
      aria-label="Evidence uploader"
      className="rounded-md border border-border bg-background p-3"
    >
      <h2 className="text-sm font-semibold">Upload evidence for VLM extraction</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">
          Schema
          <select
            value={schemaId}
            onChange={(e) =>
              setSchemaId(e.target.value as evidenceExtraction.ExtractionSchemaId)
            }
            className="ml-2 rounded border border-border bg-background px-2 py-1 text-sm"
          >
            {SCHEMAS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <input
          type="file"
          accept="image/*,application/pdf"
          aria-label="Upload an image or PDF for extraction"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
          className="text-sm"
          disabled={busy}
        />
        {busy ? <span className="text-xs">Extracting…</span> : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {result ? (
        <pre className="mt-3 max-h-64 overflow-auto rounded-sm border border-border bg-muted/30 p-2 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

function bufferToBase64(buf: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.byteLength; i += CHUNK) {
    s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(s);
}
