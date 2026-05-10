// SPDX-License-Identifier: BUSL-1.1
import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const r = req as unknown as FastifyRequest;
    const firm = r.auth?.firmId ?? 'anon';
    const ip = (r.ip ?? 'unknown') as string;
    return Promise.resolve(`${firm}:${ip}`);
  }
}
