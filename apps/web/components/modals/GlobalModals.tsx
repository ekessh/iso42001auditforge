// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { usePalette } from '@/lib/cmdk/palette-store';
import { NewEngagementModal } from './NewEngagementModal';
import { RaiseNCModal } from './RaiseNCModal';
import { RunProbeModal } from './RunProbeModal';
import { NewClientModal } from './ClientModals';
import { UploadTraceModal } from './UploadTraceModal';

/**
 * Mounts globally-available modals and dispatches palette actions to the right
 * dialog. Lives in the auditor shell so any auditor route can trigger an action.
 */
export function GlobalModals() {
  const consumeAction = usePalette((s) => s.consumeAction);
  const pendingAction = usePalette((s) => s.pendingAction);
  const router = useRouter();

  const [newEngOpen, setNewEngOpen] = React.useState(false);
  const [raiseNcOpen, setRaiseNcOpen] = React.useState(false);
  const [runProbeOpen, setRunProbeOpen] = React.useState(false);
  const [newClientOpen, setNewClientOpen] = React.useState(false);
  const [uploadTraceOpen, setUploadTraceOpen] = React.useState(false);

  React.useEffect(() => {
    if (!pendingAction) return;
    const a = consumeAction();
    if (a === 'new-engagement') setNewEngOpen(true);
    else if (a === 'raise-nc') setRaiseNcOpen(true);
    else if (a === 'run-probe') setRunProbeOpen(true);
    else if (a === 'new-client') setNewClientOpen(true);
    else if (a === 'upload-trace') setUploadTraceOpen(true);
  }, [pendingAction, consumeAction]);

  return (
    <>
      <NewEngagementModal
        open={newEngOpen}
        onOpenChange={setNewEngOpen}
        onCreated={(id) => router.push(`/engagements/${id}`)}
      />
      <RaiseNCModal open={raiseNcOpen} onOpenChange={setRaiseNcOpen} />
      <RunProbeModal open={runProbeOpen} onOpenChange={setRunProbeOpen} />
      <NewClientModal open={newClientOpen} onOpenChange={setNewClientOpen} />
      <UploadTraceModal open={uploadTraceOpen} onOpenChange={setUploadTraceOpen} />
    </>
  );
}
