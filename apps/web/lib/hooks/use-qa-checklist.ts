// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useMutation } from '@tanstack/react-query';

import { qaChecklist } from '@auditforge/api-client';

export function useEvaluateQaChecklist() {
  return useMutation({
    mutationFn: (body: qaChecklist.EvaluateBody) => qaChecklist.evaluate(body),
  });
}

export function useOverrideQaChecklistItem() {
  return useMutation({
    mutationFn: (body: qaChecklist.OverrideBody) => qaChecklist.override(body),
  });
}
