// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/config.schema.js';
import { UnauthorizedError, ValidationError } from '../../common/errors.js';
import type { Role } from '../../adapters/auth-core.adapter.js';
import type { SessionDto } from './dto.js';

interface User {
  id: string;
  username: string;
  firmId: string;
  roles: Role[];
  webauthnCredentials: Array<{ id: string; publicKey: string }>;
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  private readonly users = new Map<string, User>();
  private readonly challenges = new Map<string, { challenge: string; ts: number }>();
  private readonly sessions = new Map<string, SessionDto>();

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  async oidcStart(provider: string): Promise<{ authorizeUrl: string; state: string }> {
    if (!this.cfg.OIDC_ISSUER) throw new ValidationError('OIDC not configured');
    const state = randomBytes(16).toString('hex');
    // TODO(phase-1): use openid-client to build the real URL with PKCE.
    const authorizeUrl = `${this.cfg.OIDC_ISSUER}/authorize?client_id=${this.cfg.OIDC_CLIENT_ID}&state=${state}&provider=${provider}`;
    return { authorizeUrl, state };
  }

  async oidcCallback(_code: string, _state: string): Promise<SessionDto> {
    // TODO(phase-1): exchange code for tokens via openid-client; map to local user.
    const session: SessionDto = {
      auditorId: 'oidc-user',
      firmId: 'demo-firm',
      roles: ['lead_auditor'],
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    };
    return session;
  }

  async webauthnRegisterStart(username: string): Promise<{ challenge: string; rpId: string }> {
    const challenge = randomBytes(32).toString('base64url');
    this.challenges.set(`reg:${username}`, { challenge, ts: Date.now() });
    return { challenge, rpId: this.cfg.WEBAUTHN_RP_ID };
  }

  async webauthnRegisterFinish(username: string, _resp: Record<string, unknown>): Promise<SessionDto> {
    const c = this.challenges.get(`reg:${username}`);
    if (!c) throw new UnauthorizedError('No registration challenge');
    this.challenges.delete(`reg:${username}`);
    // TODO(phase-1): verify with @simplewebauthn/server.verifyRegistrationResponse.
    const userId = `usr_${randomBytes(8).toString('hex')}`;
    const user: User = { id: userId, username, firmId: 'demo-firm', roles: ['lead_auditor'], webauthnCredentials: [] };
    this.users.set(username, user);
    return this.issueSession(user);
  }

  async webauthnLoginStart(username: string): Promise<{ challenge: string; rpId: string }> {
    if (!this.users.has(username)) throw new UnauthorizedError('Unknown user');
    const challenge = randomBytes(32).toString('base64url');
    this.challenges.set(`auth:${username}`, { challenge, ts: Date.now() });
    return { challenge, rpId: this.cfg.WEBAUTHN_RP_ID };
  }

  async webauthnLoginFinish(username: string, _resp: Record<string, unknown>): Promise<SessionDto> {
    const c = this.challenges.get(`auth:${username}`);
    if (!c) throw new UnauthorizedError('No login challenge');
    this.challenges.delete(`auth:${username}`);
    const user = this.users.get(username);
    if (!user) throw new UnauthorizedError();
    return this.issueSession(user);
  }

  private issueSession(user: User): SessionDto {
    const session: SessionDto = {
      auditorId: user.id,
      firmId: user.firmId,
      roles: user.roles,
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    };
    const sid = randomBytes(24).toString('base64url');
    this.sessions.set(sid, session);
    return session;
  }
}
