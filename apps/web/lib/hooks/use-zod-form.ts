// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * Lightweight zod-validated form state hook.
 *
 * react-hook-form is not in deps, so we keep a minimal controlled-state hook
 * that mirrors the API surface we need (values, errors, setField, validate,
 * reset, submit). zod is the single source of truth for shape + messages.
 */

import * as React from 'react';
import type { z } from 'zod';

export interface UseZodFormOptions<TSchema extends z.ZodTypeAny> {
  schema: TSchema;
  initialValues: z.input<TSchema>;
  onSubmit: (values: z.output<TSchema>) => Promise<void> | void;
}

export interface UseZodFormResult<TSchema extends z.ZodTypeAny> {
  values: z.input<TSchema>;
  errors: Partial<Record<keyof z.input<TSchema>, string>>;
  setField: <K extends keyof z.input<TSchema>>(key: K, value: z.input<TSchema>[K]) => void;
  setValues: (values: Partial<z.input<TSchema>>) => void;
  reset: (values?: z.input<TSchema>) => void;
  submit: (e?: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
  isValid: boolean;
}

export function useZodForm<TSchema extends z.ZodTypeAny>(
  opts: UseZodFormOptions<TSchema>,
): UseZodFormResult<TSchema> {
  const { schema, initialValues, onSubmit } = opts;
  const [values, setValuesState] = React.useState<z.input<TSchema>>(initialValues);
  const [errors, setErrors] = React.useState<Partial<Record<keyof z.input<TSchema>, string>>>({});
  const [isSubmitting, setSubmitting] = React.useState(false);

  const setField: UseZodFormResult<TSchema>['setField'] = (key, value) => {
    setValuesState((v) => ({ ...v, [key]: value }));
    if (errors[key]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  };

  const setValues = (next: Partial<z.input<TSchema>>) => {
    setValuesState((v) => ({ ...v, ...next }));
  };

  const reset = (next?: z.input<TSchema>) => {
    setValuesState(next ?? initialValues);
    setErrors({});
  };

  const isValid = React.useMemo(() => schema.safeParse(values).success, [schema, values]);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof z.input<TSchema>, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof z.input<TSchema> | undefined;
        if (k && !next[k]) next[k] = issue.message;
      }
      setErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
    } finally {
      setSubmitting(false);
    }
  };

  return { values, errors, setField, setValues, reset, submit, isSubmitting, isValid };
}
