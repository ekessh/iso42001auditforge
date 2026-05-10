// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useMutation } from '@tanstack/react-query';

import { sampling } from '@auditforge/api-client';

export function useDrawSample() {
  return useMutation({
    mutationFn: (body: sampling.DrawSampleBody) => sampling.drawSample(body),
  });
}

export function useOverrideSample() {
  return useMutation({
    mutationFn: (body: sampling.OverrideSampleBody) => sampling.overrideSample(body),
  });
}

export function useCalculateSampleSize() {
  return useMutation({
    mutationFn: (body: sampling.SizeCalculatorBody) => sampling.calculateSize(body),
  });
}
