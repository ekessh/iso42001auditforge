// SPDX-License-Identifier: BUSL-1.1
import type {
  ArgumentsHost,
  ExceptionFilter} from '@nestjs/common';
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from './errors.js';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  traceId?: string;
  errors?: unknown;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest & { id?: string }>();
    const instance = req.url ?? '';
    const traceId = (req.headers['x-request-id'] as string | undefined) ?? req.id;

    const problem = this.toProblem(exception, instance, traceId);

    if (problem.status >= 500) {
      this.logger.error(
        { traceId, err: exception instanceof Error ? exception.message : String(exception) },
        'unhandled error',
      );
    }

    res
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .send(problem);
  }

  private toProblem(exception: unknown, instance: string, traceId?: string): ProblemDetails {
    if (exception instanceof DomainError) {
      return {
        type: exception.type,
        title: exception.title,
        status: exception.status,
        detail: exception.detail,
        instance,
        ...(traceId !== undefined ? { traceId } : {}),
        ...(exception.extras !== undefined ? { errors: exception.extras } : {}),
      };
    }
    if (exception instanceof ZodError) {
      return {
        type: 'https://auditforge.dev/errors/validation',
        title: 'Validation failed',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'Request body failed validation',
        instance,
        ...(traceId !== undefined ? { traceId } : {}),
        errors: exception.flatten(),
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      const detail = typeof r === 'string' ? r : ((r as { message?: string }).message ?? exception.message);
      return {
        type: `https://auditforge.dev/errors/http-${status}`,
        title: HttpStatus[status] ?? 'Error',
        status,
        detail,
        instance,
        ...(traceId !== undefined ? { traceId } : {}),
      };
    }
    return {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred',
      instance,
      ...(traceId !== undefined ? { traceId } : {}),
    };
  }
}
