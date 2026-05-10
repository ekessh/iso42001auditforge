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
import type { FindingSeverity } from '@auditforge/api-client';
import { useEngagements } from '@/lib/hooks/use-engagement';
import { useCreateFinding } from '@/lib/hooks/use-mutations';
import { useZodForm } from '@/lib/hooks/use-zod-form';

const SEVERITIES: FindingSeverity[] = ['major_nc', 'minor_nc', 'ofi'];

const FormSchema = z.object({
  engagementId: z.string().min(1, 'Pick an engagement'),
  severity: z.enum(['major_nc', 'minor_nc', 'ofi']),
  controlRef: z.string().min(1, 'Required (e.g. 4.3 or A.7.4)'),
  title: z.string().min(5, 'At least 5 chars').max(200),
  description: z.string().min(10, 'Describe the gap'),
});

export interface RaiseNCModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When pinned, the engagement field is locked to this value. */
  engagementId?: string;
}

const SEV_LABEL: Record<FindingSeverity, string> = {
  major_nc: 'Major NC',
  minor_nc: 'Minor NC',
  ofi: 'OFI',
  conformity: 'Conformity',
};

export function RaiseNCModal({ open, onOpenChange, engagementId }: RaiseNCModalProps) {
  const create = useCreateFinding();
  const engagementsQ = useEngagements({ limit: 100 });
  const items = engagementsQ.data?.items ?? [];

  const form = useZodForm({
    schema: FormSchema,
    initialValues: {
      engagementId: engagementId ?? '',
      severity: 'minor_nc' as const,
      controlRef: '',
      title: '',
      description: '',
    },
    onSubmit: async (v) => {
      await create.mutateAsync({
        engagementId: v.engagementId,
        severity: v.severity,
        controlRef: v.controlRef,
        title: v.title,
        description: v.description,
        evidence: [],
      });
      onOpenChange(false);
      form.reset();
    },
  });

  const formRef = React.useRef(form);
  formRef.current = form;
  React.useEffect(() => {
    if (open && engagementId) formRef.current.setField('engagementId', engagementId);
  }, [open, engagementId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" aria-describedby="rnc-desc">
        <DialogHeader>
          <DialogTitle>Raise nonconformity</DialogTitle>
          <DialogDescription id="rnc-desc">
            Findings raised here are draft until peer-reviewed and promoted to formal NCs in the audit report.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.submit} className="p-4 space-y-3">
          {!engagementId && (
            <div>
              <Label htmlFor="rnc-eng" required>Engagement</Label>
              <Select value={form.values.engagementId} onValueChange={(v) => form.setField('engagementId', v)}>
                <SelectTrigger id="rnc-eng" aria-invalid={Boolean(form.errors.engagementId)}>
                  <SelectValue placeholder={engagementsQ.isLoading ? 'Loading…' : 'Pick engagement'} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.id} — {e.scopeStatement.slice(0, 50)}{e.scopeStatement.length > 50 ? '…' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.errors.engagementId ? <FieldHint tone="error">{form.errors.engagementId}</FieldHint> : null}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rnc-sev" required>Severity</Label>
              <Select value={form.values.severity} onValueChange={(v) => form.setField('severity', v as 'major_nc' | 'minor_nc' | 'ofi')}>
                <SelectTrigger id="rnc-sev"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>{SEV_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rnc-ref" required>Control ref</Label>
              <Input
                id="rnc-ref"
                placeholder="4.3 or A.7.4"
                value={form.values.controlRef}
                onChange={(e) => form.setField('controlRef', e.target.value)}
                aria-invalid={Boolean(form.errors.controlRef)}
              />
              {form.errors.controlRef ? <FieldHint tone="error">{form.errors.controlRef}</FieldHint> : null}
            </div>
          </div>
          <div>
            <Label htmlFor="rnc-title" required>Title</Label>
            <Input
              id="rnc-title"
              placeholder="Concise summary"
              value={form.values.title}
              onChange={(e) => form.setField('title', e.target.value)}
              aria-invalid={Boolean(form.errors.title)}
            />
            {form.errors.title ? <FieldHint tone="error">{form.errors.title}</FieldHint> : null}
          </div>
          <div>
            <Label htmlFor="rnc-desc-input" required>Description</Label>
            <Textarea
              id="rnc-desc-input"
              rows={5}
              placeholder="Statement of the nonconformity, evidence reference, and audit trail context."
              value={form.values.description}
              onChange={(e) => form.setField('description', e.target.value)}
              aria-invalid={Boolean(form.errors.description)}
            />
            {form.errors.description ? <FieldHint tone="error">{form.errors.description}</FieldHint> : null}
          </div>
          <DialogFooter className="-mx-4 -mb-4 mt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" loading={create.isPending} disabled={!form.isValid}>Raise finding</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
