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
  Textarea,
  Label,
  FieldHint,
} from '@auditforge/ui-kit';
import { useCreateWorkingPaper } from '@/lib/hooks/use-mutations';
import { useZodForm } from '@/lib/hooks/use-zod-form';

const FormSchema = z.object({
  title: z.string().min(2).max(200),
  controlRef: z.string().min(1),
  bodyMarkdown: z.string().default(''),
});

export function NewWorkingPaperModal({
  open,
  onOpenChange,
  engagementId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  engagementId: string;
}) {
  const create = useCreateWorkingPaper();
  const form = useZodForm({
    schema: FormSchema,
    initialValues: { title: '', controlRef: '', bodyMarkdown: '' },
    onSubmit: async (v) => {
      await create.mutateAsync({
        engagementId,
        title: v.title,
        controlRef: v.controlRef,
        bodyMarkdown: v.bodyMarkdown,
        evidenceRefs: [],
      });
      form.reset();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" aria-describedby="nwp-desc">
        <DialogHeader>
          <DialogTitle>New working paper</DialogTitle>
          <DialogDescription id="nwp-desc">
            Working papers document audit procedures performed against a specific control.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.submit} className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="nwp-title" required>Title</Label>
              <Input
                id="nwp-title"
                value={form.values.title}
                onChange={(e) => form.setField('title', e.target.value)}
                aria-invalid={Boolean(form.errors.title)}
                placeholder="WP — risk register review"
              />
              {form.errors.title ? <FieldHint tone="error">{form.errors.title}</FieldHint> : null}
            </div>
            <div>
              <Label htmlFor="nwp-ref" required>Control ref</Label>
              <Input
                id="nwp-ref"
                value={form.values.controlRef}
                onChange={(e) => form.setField('controlRef', e.target.value)}
                placeholder="6.1.2"
                aria-invalid={Boolean(form.errors.controlRef)}
              />
              {form.errors.controlRef ? <FieldHint tone="error">{form.errors.controlRef}</FieldHint> : null}
            </div>
          </div>
          <div>
            <Label htmlFor="nwp-body">Initial notes (markdown)</Label>
            <Textarea
              id="nwp-body"
              rows={6}
              value={form.values.bodyMarkdown}
              onChange={(e) => form.setField('bodyMarkdown', e.target.value)}
              placeholder="## Procedure&#10;…&#10;## Evidence reviewed&#10;…&#10;## Conclusion"
            />
          </div>
          <DialogFooter className="-mx-4 -mb-4 mt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" loading={create.isPending} disabled={!form.isValid}>Create working paper</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
