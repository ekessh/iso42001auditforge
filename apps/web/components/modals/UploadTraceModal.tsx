// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  FieldHint,
} from '@auditforge/ui-kit';
import { useUploadTrace } from '@/lib/hooks/use-mutations';

export function UploadTraceModal({
  open,
  onOpenChange,
  engagementId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  engagementId?: string;
}) {
  const upload = useUploadTrace();
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState('');
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setName('');
      setDragOver(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    await upload.mutateAsync({
      file,
      name: name || file.name,
      ...(engagementId ? { engagementId } : {}),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" aria-describedby="up-desc">
        <DialogHeader>
          <DialogTitle>Upload trace</DialogTitle>
          <DialogDescription id="up-desc">
            Drop a JSON / NDJSON / OTel export. The trace is parsed for tool ACL drift, HITL gates, and recursion limits.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <Label>Trace file</Label>
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop trace file here or click to browse"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  setFile(f);
                  if (!name) setName(f.name);
                }
              }}
              className={`mt-1 cursor-pointer rounded-md border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
            >
              <Upload className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm font-medium">{file ? file.name : 'Drop file or click to browse'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">JSON, NDJSON, or OTel export</p>
              <input
                ref={inputRef}
                type="file"
                accept=".json,.ndjson,.jsonl,application/json"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    if (!name) setName(f.name);
                  }
                }}
              />
            </div>
            {file ? <FieldHint>Size: {(file.size / 1024).toFixed(1)} KB</FieldHint> : null}
          </div>
          <div>
            <Label htmlFor="up-name">Display name</Label>
            <Input id="up-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional — defaults to filename" />
          </div>
          <DialogFooter className="-mx-4 -mb-4 mt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" loading={upload.isPending} disabled={!file}>Upload trace</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
