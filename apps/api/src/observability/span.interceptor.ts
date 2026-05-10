// SPDX-License-Identifier: BUSL-1.1
/**
 * Wraps every controller call in an OTel span tagged with HTTP + audit context.
 *
 * WHY here (not the auto-HTTP instrumentation): the SDK auto-span knows the URL but not the Nest
 * controller/method, the Auth/RLS context (firm/engagement), or the Fastify route template. We
 * create a child span with these attributes so dashboards can pivot by audit firm without parsing
 * URLs.
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  SpanKind,
  SpanStatusCode,
  trace,
  type Tracer,
} from '@opentelemetry/api';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, defer, tap } from 'rxjs';

import { RequestContextStore } from '../common/request-context.js';

@Injectable()
export class ObservabilitySpanInterceptor implements NestInterceptor {
  private readonly tracer: Tracer = trace.getTracer('auditforge.api');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = ctx.getHandler();
    const cls = ctx.getClass();
    const http = ctx.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const res = http.getResponse<FastifyReply>();

    const spanName = `${cls.name}.${handler.name}`;
    return defer(() => {
      const span = this.tracer.startSpan(spanName, {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': req.method,
          'http.route': req.routeOptions?.url ?? req.url,
          'http.target': req.url,
          'auditforge.controller': cls.name,
          'auditforge.handler': handler.name,
        },
      });
      const reqCtx = RequestContextStore.get();
      if (reqCtx !== undefined) {
        span.setAttribute('audit.firm_id', reqCtx.firmId);
        span.setAttribute('audit.actor_id', reqCtx.auditorId);
        span.setAttribute('audit.request_id', reqCtx.requestId);
        if (reqCtx.engagementId !== undefined) {
          span.setAttribute('audit.engagement_id', reqCtx.engagementId);
        }
      }
      const sCtx = span.spanContext();
      void res.header(
        'server-timing',
        `app;desc="${spanName}", trace;desc="${sCtx.traceId}"`,
      );
      void res.header('x-trace-id', sCtx.traceId);

      return next.handle().pipe(
        tap({
          next: () => {
            span.setStatus({ code: SpanStatusCode.OK });
            const status = (res.statusCode ?? 0) as number;
            span.setAttribute('http.status_code', status);
            span.end();
          },
          error: (err: unknown) => {
            if (err instanceof Error) {
              span.recordException(err);
              span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            } else {
              span.setStatus({ code: SpanStatusCode.ERROR });
            }
            const status = (res.statusCode ?? 500) as number;
            span.setAttribute('http.status_code', status);
            span.end();
          },
        }),
      );
    });
  }
}
