// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';

export interface OptimisticMutationConfig<TInput, TOutput> {
  /** Compute the optimistic value before the network round-trip. */
  optimistic: (input: TInput) => TOutput;
  /** The actual network mutation. */
  mutate: (input: TInput) => Promise<TOutput>;
}

export interface OptimisticMutationResult<TInput, TOutput> {
  value: TOutput | null;
  pending: boolean;
  error: Error | null;
  apply: (input: TInput) => Promise<TOutput>;
  reset: () => void;
}

/**
 * Tiny optimistic-mutation hook. Apps use TanStack Query for production —
 * this lets ui-kit demos run without that dep and keeps types simple for
 * embedding in stories.
 */
export function useOptimisticMutation<TInput, TOutput>(
  config: OptimisticMutationConfig<TInput, TOutput>,
): OptimisticMutationResult<TInput, TOutput> {
  const [value, setValue] = React.useState<TOutput | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const apply = React.useCallback(
    async (input: TInput): Promise<TOutput> => {
      setError(null);
      const optimistic = config.optimistic(input);
      setValue(optimistic);
      setPending(true);
      try {
        const result = await config.mutate(input);
        setValue(result);
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [config],
  );

  const reset = React.useCallback(() => {
    setValue(null);
    setError(null);
    setPending(false);
  }, []);

  return { value, pending, error, apply, reset };
}
