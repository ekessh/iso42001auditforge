// SPDX-License-Identifier: BUSL-1.1
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable, of } from 'rxjs';

interface CacheEntry { body: unknown; ts: number }

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 24 * 60 * 60 * 1000;

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (req.method !== 'POST') return next.handle();
    const key = req.headers['idempotency-key'];
    if (!key || typeof key !== 'string') return next.handle();
    const composite = `${req.auth?.firmId ?? 'anon'}:${req.url}:${key}`;
    const hit = this.cache.get(composite);
    if (hit && Date.now() - hit.ts < this.ttlMs) return of(hit.body);
    return new Observable((sub) => {
      const subscription = next.handle().subscribe({
        next: (body) => {
          this.cache.set(composite, { body, ts: Date.now() });
          sub.next(body);
        },
        error: (err: unknown) => sub.error(err),
        complete: () => sub.complete(),
      });
      return () => subscription.unsubscribe();
    });
  }
}
