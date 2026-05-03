// SPDX-License-Identifier: BUSL-1.1
'use client';

import { File as FileIcon, UploadCloud, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Button } from './Button';

export interface FileDropzoneProps {
  accept?: string;
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
  hint?: React.ReactNode;
  maxSizeMb?: number;
  className?: string;
}

export const FileDropzone = ({
  accept,
  multiple = true,
  onFiles,
  hint,
  maxSizeMb = 25,
  className,
}: FileDropzoneProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [drag, setDrag] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const pushFiles = (fl: FileList | File[] | null | undefined) => {
    if (!fl) return;
    const arr = Array.from(fl);
    const oversized = arr.filter((f) => f.size > maxSizeMb * 1024 * 1024);
    if (oversized.length > 0) {
      setError(`${oversized.length} file(s) exceed the ${maxSizeMb}MB limit.`);
      return;
    }
    setError(null);
    const next = multiple ? [...files, ...arr] : arr.slice(0, 1);
    setFiles(next);
    onFiles?.(next);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pushFiles(e.dataTransfer?.files);
        }}
        aria-label="Upload evidence"
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 p-6 text-center text-sm transition-colors',
          'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          drag && 'border-primary bg-primary/5 text-primary',
        )}
      >
        <UploadCloud className="size-6 text-muted-foreground" aria-hidden />
        <span className="font-medium text-foreground">Drag &amp; drop or click to upload</span>
        <span className="text-2xs text-muted-foreground">
          {hint ?? `Max ${maxSizeMb}MB · PDF / Image / Office / JSON / CSV`}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => pushFiles(e.target.files)}
        />
      </button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {files.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
            >
              <FileIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1 truncate font-mono">{f.name}</span>
              <span className="font-mono text-2xs text-muted-foreground">
                {(f.size / 1024).toFixed(1)} KB
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${f.name}`}
                onClick={() => {
                  const next = files.filter((_, idx) => idx !== i);
                  setFiles(next);
                  onFiles?.(next);
                }}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
