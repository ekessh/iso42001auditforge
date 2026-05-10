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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from '@auditforge/ui-kit';
import { useEngagements } from '@/lib/hooks/use-engagement';
import { useProbes } from '@/lib/hooks/use-probes';
import { useCreateProbeExecution } from '@/lib/hooks/use-mutations';
import { useZodForm } from '@/lib/hooks/use-zod-form';

const FormSchema = z.object({
  engagementId: z.string().min(1, 'Pick an engagement'),
  probeId: z.string().min(1, 'Pick a probe'),
  target: z.string().min(1, 'Endpoint or model under test'),
  budgetUsd: z.number().nonnegative().max(1000),
});

export function RunProbeModal({
  open,
  onOpenChange,
  engagementId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  engagementId?: string;
}) {
  const probesQ = useProbes({ limit: 100 });
  const engagementsQ = useEngagements({ limit: 100 });
  const create = useCreateProbeExecution();
  const probes = probesQ.data?.items ?? [];
  const engagementItems = engagementsQ.data?.items ?? [];
  const [stage, setStage] = React.useState<'pick' | 'configure'>('pick');

  const form = useZodForm({
    schema: FormSchema,
    initialValues: {
      engagementId: engagementId ?? '',
      probeId: '',
      target: '',
      budgetUsd: 5,
    },
    onSubmit: async (v) => {
      await create.mutateAsync({
        engagementId: v.engagementId,
        probeId: v.probeId,
        target: v.target,
        budgetUsd: v.budgetUsd,
      });
      onOpenChange(false);
      form.reset();
      setStage('pick');
    },
  });

  const formRef = React.useRef(form);
  formRef.current = form;
  React.useEffect(() => {
    if (open) {
      setStage('pick');
      if (engagementId) formRef.current.setField('engagementId', engagementId);
    }
  }, [open, engagementId]);

  const selectedProbe = probes.find((p) => p.id === form.values.probeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" aria-describedby="rp-desc">
        <DialogHeader>
          <DialogTitle>Run probe</DialogTitle>
          <DialogDescription id="rp-desc">
            Pick a probe from the catalogue and configure the run target. Probe runs are
            cost- and time-bounded; results are linked to the engagement audit trail.
          </DialogDescription>
        </DialogHeader>
        {stage === 'pick' ? (
          <div className="p-4">
            {!engagementId && (
              <div className="mb-3">
                <Label htmlFor="rp-eng" required>Engagement</Label>
                <Select value={form.values.engagementId} onValueChange={(v) => form.setField('engagementId', v)}>
                  <SelectTrigger id="rp-eng"><SelectValue placeholder="Pick engagement" /></SelectTrigger>
                  <SelectContent>
                    {engagementItems.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.id} — {e.scopeStatement.slice(0, 50)}{e.scopeStatement.length > 50 ? '…' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Label>Catalogue ({probes.length})</Label>
            <ul className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border" role="listbox" aria-label="Probe catalogue">
              {probesQ.isLoading ? (
                <li className="p-4 text-xs text-muted-foreground">Loading…</li>
              ) : probes.length === 0 ? (
                <li className="p-4 text-xs text-muted-foreground">No probes available.</li>
              ) : (
                probes.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={form.values.probeId === p.id}
                      onClick={() => {
                        form.setField('probeId', p.id);
                        form.setField('budgetUsd', p.budgetUsd);
                      }}
                      className={`w-full text-left p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${form.values.probeId === p.id ? 'bg-muted' : 'hover:bg-muted/60'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{p.category}</div>
                        </div>
                        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Badge tone={p.mode === 'live' ? 'warning' : p.mode === 'replay' ? 'info' : 'success'}>{p.mode}</Badge>
                          <span className="tabular-nums">${p.budgetUsd.toFixed(2)}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <DialogFooter className="-mx-4 -mb-4 mt-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                type="button"
                size="sm"
                disabled={!form.values.probeId || !form.values.engagementId}
                onClick={() => setStage('configure')}
              >
                Continue
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={form.submit} className="p-4 space-y-3">
            <div className="rounded-md border border-border p-2.5 bg-muted/40">
              <div className="text-xs font-semibold">{selectedProbe?.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{selectedProbe?.category}</div>
            </div>
            <div>
              <Label htmlFor="rp-target" required>Target endpoint or model</Label>
              <Input
                id="rp-target"
                placeholder="https://api.example.com/v1/chat or model-id"
                value={form.values.target}
                onChange={(e) => form.setField('target', e.target.value)}
                aria-invalid={Boolean(form.errors.target)}
              />
              {form.errors.target ? <FieldHint tone="error">{form.errors.target}</FieldHint> : null}
            </div>
            <div>
              <Label htmlFor="rp-budget" required>Budget USD</Label>
              <Input
                id="rp-budget"
                type="number"
                min="0"
                step="0.10"
                value={form.values.budgetUsd}
                onChange={(e) => form.setField('budgetUsd', Number(e.target.value))}
              />
            </div>
            <DialogFooter className="-mx-4 -mb-4 mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setStage('pick')}>&larr; Back</Button>
              <Button type="submit" size="sm" loading={create.isPending} disabled={!form.isValid}>Queue probe run</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
