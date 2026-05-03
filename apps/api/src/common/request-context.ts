// SPDX-License-Identifier: BUSL-1.1
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '../adapters/auth-core.adapter.js';

export interface RequestContext {
  requestId: string;
  firmId: string;
  auditorId: string;
  engagementId?: string | undefined;
  roles: readonly Role[];
  webAuthnAttestation?: string | undefined;
  idempotencyKey?: string | undefined;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const RequestContextStore = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
  require(): RequestContext {
    const ctx = storage.getStore();
    if (!ctx) throw new Error('RequestContext not initialized');
    return ctx;
  },
};
