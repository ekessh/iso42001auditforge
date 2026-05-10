// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { colorForAuditor } from '@auditforge/working-papers';

export interface WorkingPaperEditorProps {
  doc: Y.Doc;
  awareness: Awareness;
  fragmentName?: string;
  user: { auditorId: string; displayName: string };
  ariaLabel?: string;
  readOnly?: boolean;
}

/**
 * Tiptap editor bound to a Yjs XmlFragment with collaboration cursor.
 * WHY no autofocus by default: screen-reader users land on the doc title; the
 * editor announces presence changes only via the live region in PresenceList.
 */
export function WorkingPaperEditor({
  doc,
  awareness,
  fragmentName = 'body',
  user,
  ariaLabel = 'Working paper editor',
  readOnly = false,
}: WorkingPaperEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: doc, field: fragmentName }),
        CollaborationCursor.configure({
          provider: { awareness } as { awareness: Awareness },
          user: {
            name: user.displayName,
            color: colorForAuditor(user.auditorId),
          },
        }),
      ],
      editable: !readOnly,
      editorProps: {
        attributes: {
          'aria-label': ariaLabel,
          'aria-readonly': readOnly ? 'true' : 'false',
          role: 'textbox',
          'aria-multiline': 'true',
          class:
            'prose prose-sm max-w-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-3 min-h-[180px] bg-background',
        },
      },
      immediatelyRender: false,
    },
    [doc, awareness, fragmentName, readOnly, user.auditorId, user.displayName],
  );

  React.useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
      >
        Loading collaborative editor…
      </div>
    );
  }

  return <EditorContent editor={editor} />;
}
