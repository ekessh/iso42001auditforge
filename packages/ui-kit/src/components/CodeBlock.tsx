// SPDX-License-Identifier: BUSL-1.1
'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  language?: string;
  code: string;
  /** Show line numbers. */
  lineNumbers?: boolean;
  /** Optional file name caption. */
  filename?: string;
}

/**
 * Lightweight code block. Apps integrate Shiki at render time for full syntax
 * highlighting; this primitive guarantees layout, copy-to-clipboard, and a11y
 * regardless of highlighter availability.
 */
export const CodeBlock = React.forwardRef<HTMLPreElement, CodeBlockProps>(
  ({ language, code, lineNumbers, filename, className, ...rest }, ref) => {
    const [copied, setCopied] = React.useState(false);
    const onCopy = async () => {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        // Clipboard may be denied — silent fail is acceptable.
      }
    };
    const lines = code.split('\n');

    return (
      <figure className={cn('overflow-hidden rounded-md border border-border bg-neutral-950 text-neutral-100', className)}>
        <figcaption className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5 text-2xs">
          <span className="font-mono text-neutral-300">
            {filename ?? language ?? 'code'}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-6 items-center gap-1 rounded border border-neutral-700 px-1.5 text-2xs text-neutral-300 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={copied ? 'Copied' : 'Copy code'}
          >
            {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </figcaption>
        <pre
          ref={ref}
          className="overflow-x-auto p-3 font-mono text-xs leading-relaxed"
          {...rest}
        >
          <code className={`language-${language ?? 'text'}`}>
            {lineNumbers
              ? lines.map((line, i) => (
                  <span key={i} className="flex">
                    <span
                      aria-hidden
                      className="mr-3 inline-block w-7 select-none text-right text-neutral-500"
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1">{line || ' '}</span>
                  </span>
                ))
              : code}
          </code>
        </pre>
      </figure>
    );
  },
);
CodeBlock.displayName = 'CodeBlock';
