// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * Centralised mutation hooks. Every write returns toasts via sonner so callers
 * only need to call `mutate(...)` — no boilerplate. Successful mutations
 * invalidate the relevant TanStack Query keys; failures surface server message.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  engagements as eng,
  findings as fnd,
  clients as cli,
  probes as prb,
  workingPapers as wp,
  traces as trc,
  type CreateEngagementInput,
  type UpdateEngagementInput,
  type CreateFindingInput,
  type UpdateFindingInput,
  type CapaFindingInput,
  type CreateClientInput,
  type UpdateClientInput,
  type CreateProbeExecutionInput,
  type CreateWorkingPaperInput,
  type UpdateWorkingPaperInput,
  type UploadTraceInput,
} from '@auditforge/api-client';

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Request failed';
}

export function useCreateEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEngagementInput) => eng.createEngagement(input),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['engagements'] });
      qc.setQueryData(['engagement', created.id], created);
      toast.success('Engagement created', { description: created.scopeStatement });
    },
    onError: (err) => toast.error('Could not create engagement', { description: describeError(err) }),
  });
}

export function useUpdateEngagement(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEngagementInput) => eng.updateEngagement(id, input),
    onSuccess: (updated) => {
      qc.setQueryData(['engagement', id], updated);
      qc.invalidateQueries({ queryKey: ['engagements'] });
      toast.success('Engagement updated');
    },
    onError: (err) => toast.error('Could not update engagement', { description: describeError(err) }),
  });
}

export function useGenerateReportDraft(engagementId: string) {
  return useMutation({
    mutationFn: () => eng.generateReportDraft(engagementId),
    onSuccess: () => toast.success('Report draft generated'),
    onError: (err) => toast.error('Could not generate report', { description: describeError(err) }),
  });
}

export function useCreateFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFindingInput) => fnd.createFinding(input),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['findings'] });
      qc.invalidateQueries({ queryKey: ['finding', created.id] });
      toast.success('Finding raised', { description: created.title });
    },
    onError: (err) => toast.error('Could not raise finding', { description: describeError(err) }),
  });
}

export function useUpdateFinding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFindingInput) => fnd.updateFinding(id, input),
    onSuccess: (updated) => {
      qc.setQueryData(['finding', id], updated);
      qc.invalidateQueries({ queryKey: ['findings'] });
      toast.success('Finding updated');
    },
    onError: (err) => toast.error('Could not update finding', { description: describeError(err) }),
  });
}

export function usePromoteFinding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fnd.promoteFinding(id),
    onSuccess: (updated) => {
      qc.setQueryData(['finding', id], updated);
      qc.invalidateQueries({ queryKey: ['findings'] });
      toast.success('Finding promoted to formal NC');
    },
    onError: (err) => toast.error('Could not promote finding', { description: describeError(err) }),
  });
}

export function useRecordCapa(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CapaFindingInput) => fnd.recordCapa(id, input),
    onSuccess: (updated) => {
      qc.setQueryData(['finding', id], updated);
      qc.invalidateQueries({ queryKey: ['findings'] });
      toast.success('CAPA recorded');
    },
    onError: (err) => toast.error('Could not record CAPA', { description: describeError(err) }),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientInput) => cli.createClient(input),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.setQueryData(['client', created.id], created);
      toast.success('Client created', { description: created.name });
    },
    onError: (err) => toast.error('Could not create client', { description: describeError(err) }),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateClientInput) => cli.updateClient(id, input),
    onSuccess: (updated) => {
      qc.setQueryData(['client', id], updated);
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client updated');
    },
    onError: (err) => toast.error('Could not update client', { description: describeError(err) }),
  });
}

export function useArchiveClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cli.archiveClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', id] });
      toast.success('Client archived');
    },
    onError: (err) => toast.error('Could not archive client', { description: describeError(err) }),
  });
}

export function useCreateProbeExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProbeExecutionInput) => prb.createProbeExecution(input),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['probe-executions', created.engagementId] });
      toast.success('Probe execution queued', { description: `Probe ${created.probeId}` });
    },
    onError: (err) => toast.error('Could not start probe', { description: describeError(err) }),
  });
}

export function useCreateWorkingPaper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkingPaperInput) => wp.createWorkingPaper(input),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['working-papers'] });
      qc.setQueryData(['working-paper', created.id], created);
      toast.success('Working paper created', { description: created.title });
    },
    onError: (err) => toast.error('Could not create working paper', { description: describeError(err) }),
  });
}

export function useUpdateWorkingPaper(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkingPaperInput) => wp.updateWorkingPaper(id, input),
    onSuccess: (updated) => {
      qc.setQueryData(['working-paper', id], updated);
      qc.invalidateQueries({ queryKey: ['working-papers'] });
      toast.success('Working paper updated');
    },
    onError: (err) => toast.error('Could not update working paper', { description: describeError(err) }),
  });
}

export function useUploadTrace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadTraceInput) => trc.uploadTrace(input),
    onSuccess: (uploaded) => {
      qc.invalidateQueries({ queryKey: ['traces'] });
      toast.success('Trace uploaded', { description: uploaded.name });
    },
    onError: (err) => toast.error('Could not upload trace', { description: describeError(err) }),
  });
}
