// SPDX-License-Identifier: BUSL-1.1
'use client';

import { Bold, Code, Italic, List, ListOrdered, Quote } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * RichTextEditor — content-editable shell that mirrors Tiptap's API surface.
 *
 * Apps integrate Tiptap directly when needed; this primitive keeps Storybook
 * + initial dev unblocked without making Tiptap a hard build-time dependency
 * of the design package.
 */
export interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  minHeight?: number;
}

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Type your observation…',
  ariaLabel = 'Rich text editor',
  className,
  minHeight = 160,
}: RichTextEditorProps) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = React.useState(!value);

  React.useEffect(() => {
    if (ref.current && value !== undefined && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
      setEmpty(!ref.current.textContent);
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    ref.current?.focus();
    onChange?.(ref.current?.innerHTML ?? '');
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-md border border-input bg-card focus-within:border-ring focus-within:ring-2 focus-within:ring-ring',
        className,
      )}
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex items-center gap-0.5 border-b border-border px-2 py-1"
      >
        <ToolbarBtn label="Bold (⌘B)" onClick={() => exec('bold')}>
          <Bold className="size-3.5" aria-hidden />
        </ToolbarBtn>
        <ToolbarBtn label="Italic (⌘I)" onClick={() => exec('italic')}>
          <Italic className="size-3.5" aria-hidden />
        </ToolbarBtn>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolbarBtn label="Bulleted list" onClick={() => exec('insertUnorderedList')}>
          <List className="size-3.5" aria-hidden />
        </ToolbarBtn>
        <ToolbarBtn label="Numbered list" onClick={() => exec('insertOrderedList')}>
          <ListOrdered className="size-3.5" aria-hidden />
        </ToolbarBtn>
        <ToolbarBtn label="Quote" onClick={() => exec('formatBlock', 'blockquote')}>
          <Quote className="size-3.5" aria-hidden />
        </ToolbarBtn>
        <ToolbarBtn label="Inline code" onClick={() => exec('formatBlock', 'pre')}>
          <Code className="size-3.5" aria-hidden />
        </ToolbarBtn>
      </div>
      <div className="relative">
        {empty ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground"
          >
            {placeholder}
          </span>
        ) : null}
        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          contentEditable
          suppressContentEditableWarning
          className="prose prose-sm max-w-none p-3 text-sm leading-relaxed outline-none focus:outline-none [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          style={{ minHeight }}
          onInput={(e) => {
            const node = e.currentTarget;
            setEmpty(!node.textContent);
            onChange?.(node.innerHTML);
          }}
        />
      </div>
    </div>
  );
};

const ToolbarBtn = ({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {children}
  </button>
);
