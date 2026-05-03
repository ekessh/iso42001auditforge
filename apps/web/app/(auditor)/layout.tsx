// SPDX-License-Identifier: BUSL-1.1
import type { ReactNode } from 'react';
import { AuditorShell } from './shell';
export default function AuditorLayout({ children }: { children: ReactNode }) {
  return <AuditorShell>{children}</AuditorShell>;
}
