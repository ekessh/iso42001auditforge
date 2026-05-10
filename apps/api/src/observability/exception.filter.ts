// SPDX-License-Identifier: BUSL-1.1
/**
 * Records uncaught exceptions on the active span and emits a structured error log.
 *
 * WHY a separate filter (we already have ProblemDetailsFilter): the problem-details filter shapes
 * the response body and must remain laser-focused on RFC 7807. Observability concerns (span
 * exception event, structured log) are independent and run side-effect-only — separating them
 * keeps each filter trivial to test.
 */
import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import type { FastifyRequest } from 'fastify';

import { redactValue } from '@auditforge/observability';

@Catch()
export class ObservabilityExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Observability');

  catch(exception: unknown, host: ArgumentsHost): void {
    const span = trace.getActiveSpan();
    if (span !== undefined) {
      if (exception instanceof Error) {
        span.recordException(exception);
      } else {
        span.recordException({ name: 'NonErrorThrow', message: safeStringify(exception) });
      }
    }
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const path = req?.url ?? 'unknown';
    const method = req?.method ?? 'unknown';
    const errPayload = exception instanceof Error
      ? { name: exception.name, message: exception.message, stack: exception.stack }
      : { value: safeStringify(exception) };
    this.logger.error(
      JSON.stringify(redactValue({ method, path, error: errPayload })),
    );
    throw exception as Error;
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
