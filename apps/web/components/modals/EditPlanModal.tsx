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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@auditforge/ui-kit';
import type { Engagement } from '@auditforge/api-client';
import { useUpdateEngagement } from '@/lib/hooks/use-mutations';
import { useZodForm } from '@/lib/hooks/use-zod-form';

const STAGES = ['stage1', 'stage2', 'surveillance', 'recertification', 'special'] as const;
const STATUSES = ['planned', 'in_progress', 'reporting', 'reviewed', 'issued', 'archived', 'cancelled'] as const;

const FormSchema = z.object({
  scopeStatement: z.string().min(10),
  stage: z.enum(STAGES),
  status: z.enum(STATUSES),
  startsOn: z.string().min(1),
  endsOn: z.string().min(1),
  leadAuditorId: z.string().min(1),
  teamMemberIds: z.string(),
});

export interface EditPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagement: Engagement;
}

export function EditPlanModal({ open, onOpenChange, engagement }: EditPlanModalProps) {
  const update = useUpdateEngagement(engagement.id);

  const form = useZodForm({
    schema: FormSchema,
    initialValues: {
      scopeStatement: engagement.scopeStatement,
      stage: engagement.stage,
      status: engagement.status,
      startsOn: engagement.startsOn.slice(0, 10),
      endsOn: engagement.endsOn.slice(0, 10),
      leadAuditorId: engagement.leadAuditorId,
      teamMemberIds: (engagement.teamMemberIds ?? []).join(', '),
    },
    onSubmit: async (v) => {
      await update.mutateAsync({
        scopeStatement: v.scopeStatement,
        stage: v.stage,
        status: v.status,
        startsOn: v.startsOn,
        endsOn: v.endsOn,
        leadAuditorId: v.leadAuditorId,
        teamMemberIds: v.teamMemberIds.split(',').map((s) => s.trim()).filter(Boolean),
      });
      onOpenChange(false);
    },
  });

  const formRef = React.useRef(form);
  formRef.current = form;
  React.useEffect(() => {
    if (open) {
      formRef.current.reset({
        scopeStatement: engagement.scopeStatement,
        stage: engagement.stage,
        status: engagement.status,
        startsOn: engagement.startsOn.slice(0, 10),
        endsOn: engagement.endsOn.slice(0, 10),
        leadAuditorId: engagement.leadAuditorId,
        teamMemberIds: (engagement.teamMemberIds ?? []).join(', '),
      });
    }
  }, [open, engagement.id, engagement.scopeStatement, engagement.stage, engagement.status, engagement.startsOn, engagement.endsOn, engagement.leadAuditorId, engagement.teamMemberIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" aria-describedby="ep-desc">
        <DialogHeader>
          <DialogTitle>Edit audit plan</DialogTitle>
          <DialogDescription id="ep-desc">
            Plan edits are recorded on the audit ledger as a hash-chained event.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.submit} className="p-4 space-y-3">
          <div>
            <Label htmlFor="ep-scope" required>Scope statement</Label>
            <Textarea
              id="ep-scope"
              rows={3}
              value={form.values.scopeStatement}
              onChange={(e) => form.setField('scopeStatement', e.target.value)}
              aria-invalid={Boolean(form.errors.scopeStatement)}
            />
            {form.errors.scopeStatement ? <FieldHint tone="error">{form.errors.scopeStatement}</FieldHint> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ep-stage" required>Stage</Label>
              <Select value={form.values.stage} onValueChange={(v) => form.setField('stage', v as typeof STAGES[number])}>
                <SelectTrigger id="ep-stage"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ep-status" required>Status</Label>
              <Select value={form.values.status} onValueChange={(v) => form.setField('status', v as typeof STATUSES[number])}>
                <SelectTrigger id="ep-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ep-starts" required>Starts on</Label>
              <Input id="ep-starts" type="date" value={form.values.startsOn} onChange={(e) => form.setField('startsOn', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ep-ends" required>Ends on</Label>
              <Input id="ep-ends" type="date" value={form.values.endsOn} onChange={(e) => form.setField('endsOn', e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="ep-lead" required>Lead auditor ID</Label>
            <Input id="ep-lead" value={form.values.leadAuditorId} onChange={(e) => form.setField('leadAuditorId', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ep-team">Team member IDs (comma separated)</Label>
            <Input id="ep-team" value={form.values.teamMemberIds} onChange={(e) => form.setField('teamMemberIds', e.target.value)} />
          </div>
          <DialogFooter className="-mx-4 -mb-4 mt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" loading={update.isPending} disabled={!form.isValid}>Save plan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
