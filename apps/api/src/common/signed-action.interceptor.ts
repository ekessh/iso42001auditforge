// SPDX-License-Identifier: BUSL-1.1
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { SigningRequiredError } from './errors.js';

export const REQUIRES_SIGNED = 'requiresSigned';
export const RequiresSignedAction = (): MethodDecorator => SetMetadata(REQUIRES_SIGNED, true);

@Injectable()
export class SignedActionInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = Reflect.getMetadata(REQUIRES_SIGNED, ctx.getHandler()) === true;
    if (!required) return next.handle();
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const attestation = req.headers['x-webauthn-attestation'];
    if (!attestation || typeof attestation !== 'string' || attestation.length < 16) {
      throw new SigningRequiredError();
    }
    // TODO(phase-1): verify attestation signature against challenge using @simplewebauthn/server.
    return next.handle();
  }
}
