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
import { useClients } from '@/lib/hooks/use-clients';
import { useCreateClient, useCreateEngagement } from '@/lib/hooks/use-mutations';
import { useZodForm } from '@/lib/hooks/use-zod-form';
import { useAuth } from '@/lib/store/auth-store';

const STAGES = ['stage1', 'stage2', 'surveillance', 'recertification', 'special'] as const;
const MODES = ['audit', 'readiness'] as const;

const FormSchema = z.object({
  clientId: z.string().min(1, 'Pick a client'),
  mode: z.enum(MODES),
  stage: z.enum(STAGES),
  scopeStatement: z.string().min(10, 'Describe the AIMS scope'),
  startsOn: z.string().min(1, 'Required'),
  endsOn: z.string().min(1, 'Required'),
});

export interface NewEngagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function NewEngagementModal({ open, onOpenChange, onCreated }: NewEngagementModalProps) {
  const auditorId = useAuth((s) => s.auditor?.id) ?? 'auditor-001';
  const [step, setStep] = React.useState<1 | 2>(1);
  const [creatingClient, setCreatingClient] = React.useState(false);
  const [newClientName, setNewClientName] = React.useState('');

  const clientsQ = useClients({ limit: 100 });
  const createClient = useCreateClient();
  const createEngagement = useCreateEngagement();

  const today = new Date().toISOString().slice(0, 10);
  const inSixWeeks = new Date(Date.now() + 1000 * 60 * 60 * 24 * 42).toISOString().slice(0, 10);

  const form = useZodForm({
    schema: FormSchema,
    initialValues: {
      clientId: '',
      mode: 'audit' as const,
      stage: 'stage2' as const,
      scopeStatement: '',
      startsOn: today,
      endsOn: inSixWeeks,
    },
    onSubmit: async (v) => {
      const created = await createEngagement.mutateAsync({
        clientId: v.clientId,
        mode: v.mode,
        stage: v.stage,
        scopeStatement: v.scopeStatement,
        startsOn: v.startsOn,
        endsOn: v.endsOn,
        leadAuditorId: auditorId,
        teamMemberIds: [auditorId],
      });
      onCreated?.(created.id);
      handleClose();
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep(1);
      setCreatingClient(false);
      setNewClientName('');
      form.reset();
    }, 200);
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    const c = await createClient.mutateAsync({ name: newClientName.trim() });
    form.setField('clientId', c.id);
    setCreatingClient(false);
    setNewClientName('');
  };

  const canAdvance = Boolean(form.values.clientId);
  const clients = clientsQ.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent size="lg" aria-describedby="ne-desc">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Pick client' : 'Define audit plan'}</DialogTitle>
          <DialogDescription id="ne-desc">
            Step {step} of 2 — {step === 1 ? 'select an existing client or create a new one.' : 'set scope, mode, stage, and timeline.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 1) {
              if (canAdvance) setStep(2);
            } else {
              void form.submit();
            }
          }}
          className="p-4 space-y-3"
        >
          {step === 1 ? (
            <div className="space-y-3">
              {!creatingClient ? (
                <>
                  <div>
                    <Label htmlFor="ne-client" required>Client</Label>
                    <Select value={form.values.clientId} onValueChange={(v) => form.setField('clientId', v)}>
                      <SelectTrigger id="ne-client" aria-invalid={Boolean(form.errors.clientId)}>
                        <SelectValue placeholder={clientsQ.isLoading ? 'Loading…' : 'Pick a client'} />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.errors.clientId ? <FieldHint tone="error">{form.errors.clientId}</FieldHint> : null}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCreatingClient(true)}>
                    + New client inline
                  </Button>
                </>
              ) : (
                <div className="rounded-md border border-border p-3 space-y-2 bg-muted/40">
                  <Label htmlFor="ne-new-client" required>New client name</Label>
                  <Input
                    id="ne-new-client"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="e.g. Acme MedAI Ltd"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingClient(false)}>Cancel</Button>
                    <Button type="button" size="sm" loading={createClient.isPending} onClick={handleCreateClient} disabled={!newClientName.trim()}>
                      Create client
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ne-mode" required>Mode</Label>
                  <Select value={form.values.mode} onValueChange={(v) => form.setField('mode', v as 'audit' | 'readiness')}>
                    <SelectTrigger id="ne-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="audit">Audit (formal certification)</SelectItem>
                      <SelectItem value="readiness">Readiness (gap assessment)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ne-stage" required>Stage</Label>
                  <Select value={form.values.stage} onValueChange={(v) => form.setField('stage', v as typeof STAGES[number])}>
                    <SelectTrigger id="ne-stage"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="ne-scope" required>Scope statement</Label>
                <Textarea
                  id="ne-scope"
                  rows={3}
                  value={form.values.scopeStatement}
                  onChange={(e) => form.setField('scopeStatement', e.target.value)}
                  placeholder="AIMS covering …"
                  aria-invalid={Boolean(form.errors.scopeStatement)}
                />
                {form.errors.scopeStatement ? <FieldHint tone="error">{form.errors.scopeStatement}</FieldHint> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ne-starts" required>Starts on</Label>
                  <Input
                    id="ne-starts"
                    type="date"
                    value={form.values.startsOn}
                    onChange={(e) => form.setField('startsOn', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ne-ends" required>Ends on</Label>
                  <Input
                    id="ne-ends"
                    type="date"
                    value={form.values.endsOn}
                    onChange={(e) => form.setField('endsOn', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="-mx-4 -mb-4 mt-4">
            {step === 2 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)}>&larr; Back</Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
            )}
            <Button
              type="submit"
              size="sm"
              loading={createEngagement.isPending}
              disabled={step === 1 ? !canAdvance : false}
            >
              {step === 1 ? 'Continue' : 'Create engagement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
