// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { z } from 'zod';
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
import type { Client } from '@auditforge/api-client';
import { useCreateClient, useUpdateClient, useArchiveClient } from '@/lib/hooks/use-mutations';
import { useZodForm } from '@/lib/hooks/use-zod-form';

const NameSchema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(200),
});

export function NewClientModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const create = useCreateClient();
  const form = useZodForm({
    schema: NameSchema,
    initialValues: { name: '' },
    onSubmit: async (v) => {
      const c = await create.mutateAsync({ name: v.name });
      onCreated?.(c.id);
      form.reset();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" aria-describedby="nc-desc">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription id="nc-desc">
            Add an auditee organisation. Engagements are scoped under a client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.submit} className="p-4 space-y-3">
          <div>
            <Label htmlFor="nc-name" required>Client name</Label>
            <Input
              id="nc-name"
              autoFocus
              value={form.values.name}
              onChange={(e) => form.setField('name', e.target.value)}
              aria-invalid={Boolean(form.errors.name)}
              placeholder="e.g. Acme MedAI Ltd"
            />
            {form.errors.name ? <FieldHint tone="error">{form.errors.name}</FieldHint> : null}
          </div>
          <DialogFooter className="-mx-4 -mb-4 mt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" loading={create.isPending} disabled={!form.isValid}>Create client</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditClientModal({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: Client;
}) {
  const update = useUpdateClient(client.id);
  const form = useZodForm({
    schema: NameSchema,
    initialValues: { name: client.name },
    onSubmit: async (v) => {
      await update.mutateAsync({ name: v.name });
      onOpenChange(false);
    },
  });

  const formRef = React.useRef(form);
  formRef.current = form;
  React.useEffect(() => {
    if (open) formRef.current.reset({ name: client.name });
  }, [open, client.id, client.name]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" aria-describedby="ec-desc">
        <DialogHeader>
          <DialogTitle>Edit client</DialogTitle>
          <DialogDescription id="ec-desc">Rename the client. ID and history are preserved.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.submit} className="p-4 space-y-3">
          <div>
            <Label htmlFor="ec-name" required>Client name</Label>
            <Input id="ec-name" autoFocus value={form.values.name} onChange={(e) => form.setField('name', e.target.value)} />
            {form.errors.name ? <FieldHint tone="error">{form.errors.name}</FieldHint> : null}
          </div>
          <DialogFooter className="-mx-4 -mb-4 mt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" loading={update.isPending} disabled={!form.isValid}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveClientButton({ client }: { client: Client }) {
  const archive = useArchiveClient(client.id);
  const [confirming, setConfirming] = React.useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="xs" onClick={() => setConfirming(true)}>
        Archive
      </Button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Button type="button" variant="ghost" size="xs" onClick={() => setConfirming(false)}>Cancel</Button>
      <Button
        type="button"
        variant="destructive"
        size="xs"
        loading={archive.isPending}
        onClick={() => archive.mutate(undefined, { onSettled: () => setConfirming(false) })}
      >
        Confirm
      </Button>
    </span>
  );
}
