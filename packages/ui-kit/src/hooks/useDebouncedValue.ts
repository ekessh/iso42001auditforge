// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';

/** Returns a debounced copy of value. Useful for search inputs. */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
