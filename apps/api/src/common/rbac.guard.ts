// SPDX-License-Identifier: BUSL-1.1
import type {
  CanActivate,
  ExecutionContext} from '@nestjs/common';
import {
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { type Action, type Role, can } from '../adapters/auth-core.adapter.js';
import { ForbiddenError, UnauthorizedError } from './errors.js';

export const RBAC_KEY = 'rbac';
export interface RbacRequirement {
  resource: string;
  action: Action;
}
export const Rbac = (resource: string, action: Action): MethodDecorator =>
  SetMetadata(RBAC_KEY, { resource, action } satisfies RbacRequirement);

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (!req.auth) throw new UnauthorizedError();
    const req4 = this.reflector.getAllAndOverride<RbacRequirement | undefined>(RBAC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!req4) return true; // route opts out
    const roles = req.auth.roles as readonly Role[];
    if (!can(roles, req4.resource, req4.action)) {
      throw new ForbiddenError(`Missing permission ${req4.action} on ${req4.resource}`);
    }
    return true;
  }
}
