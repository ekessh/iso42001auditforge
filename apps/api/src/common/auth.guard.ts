// SPDX-License-Identifier: BUSL-1.1
import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { UnauthorizedError } from './errors.js';

export const PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const isPublic = Reflect.getMetadata(PUBLIC_KEY, context.getHandler())
      || Reflect.getMetadata(PUBLIC_KEY, context.getClass());
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    if (!req.auth) throw new UnauthorizedError();
    return true;
  }
}
