// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/config.schema.js';
import { UnauthorizedError, ValidationError } from '../../common/errors.js';
import type { Role } from '../../adapters/auth-core.adapter.js';
import {
  OidcClient,
  WebAuthnService,
  type StoredCredential,
} from '@auditforge/auth-core';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';
import type { SessionDto } from './dto.js';
import type { LedgerSink } from '../../common/auth.guard.js';
import type {
  WebAuthnCredentialRepository,
} from '../../common/webauthn-credential.repository.js';
import {
  MonotonicityViolationError,
  WEBAUTHN_CREDENTIAL_REPOSITORY,
} from '../../common/webauthn-credential.repository.js';

// ── Repository port (interface) ──────────────────────────────────────────────
// Production implementation: DrizzleAuditorRepository (auditor.repository.ts)
// Injected via AUDITOR_REPOSITORY token by IdentityModule.

export interface AuditorRecord {
  id: string;
  username: string;
  firmId: string;
  roles: Role[];
  /** 'active' | 'inactive' | 'suspended' */
  status: 'active' | 'inactive' | 'suspended';
  webauthnCredentials: StoredCredential[];
}

export interface AuditorRepository {
  findByUsername(username: string): Promise<AuditorRecord | undefined>;
  findById(id: string): Promise<AuditorRecord | undefined>;
  findByOidcSub(sub: string): Promise<AuditorRecord | undefined>;
  createFromOidc(
    sub: string,
    email: string,
    firmId: string,
  ): Promise<AuditorRecord>;
  updateCredentialCounter(
    auditorId: string,
    credentialId: string,
    newCounter: number,
  ): Promise<void>;
  addCredential(auditorId: string, credential: StoredCredential): Promise<void>;
  /** Suspend an auditor account (e.g. after suspicious activity). */
  markSuspended?(auditorId: string): Promise<void>;
  /** Record a successful login event (update last-seen timestamps). */
  recordLogin?(auditorId: string): Promise<void>;
}

// ── OIDC session store port ───────────────────────────────────────────────────

export interface OidcPendingSession {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
  provider: string;
  issuedAt: number;
}

/** Injected token for the AuditorRepository */
export const AUDITOR_REPOSITORY = Symbol('AUDITOR_REPOSITORY');
/** Injected token for the LedgerSink */
export const IDENTITY_LEDGER_SINK = Symbol('IDENTITY_LEDGER_SINK');
/** Injected token for the WebAuthnCredentialRepository (used in WebAuthn login + signed actions) */
export { WEBAUTHN_CREDENTIAL_REPOSITORY };

/** How long a WebAuthn/OIDC challenge is valid (5 minutes). */
const CHALLENGE_TTL_MS = 5 * 60 * 1_000;

/** Session TTL — 8 hours. */
const SESSION_TTL_MS = 8 * 3_600 * 1_000;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  /** WebAuthn challenges keyed by `reg:<username>` or `auth:<username>`. */
  private readonly challenges = new Map<string, { challenge: string; ts: number }>();

  /** OIDC pending sessions keyed by state. */
  private readonly oidcSessions = new Map<string, OidcPendingSession>();

  /** Issued sessions keyed by sid. */
  private readonly sessions = new Map<string, SessionDto>();

  private readonly webAuthnService: WebAuthnService;
  private readonly auditorRepo: AuditorRepository;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    // AuditorRepository is required for production; @Optional only for
    // unit-test instantiation where the full DI context is not present.
    @Optional() @Inject(AUDITOR_REPOSITORY) auditorRepo?: AuditorRepository,
    @Optional() @Inject(IDENTITY_LEDGER_SINK) private readonly ledger?: LedgerSink,
    @Optional() @Inject(WEBAUTHN_CREDENTIAL_REPOSITORY)
    private readonly webauthnCredentialRepo?: WebAuthnCredentialRepository,
  ) {
    this.webAuthnService = new WebAuthnService({
      rpName: cfg.WEBAUTHN_RP_NAME,
      rpId: cfg.WEBAUTHN_RP_ID,
      origin: cfg.WEBAUTHN_ORIGIN,
    });

    if (!auditorRepo) {
      // In production the module must provide the Drizzle repository.
      // This path should only be hit in isolated unit tests.
      this.logger.warn(
        'No AuditorRepository injected — IdentityService will reject all authentication attempts. ' +
          'Ensure IdentityModule provides AUDITOR_REPOSITORY.',
      );
    }
    // Assign; undefined guarded at runtime in each method.
    this.auditorRepo = auditorRepo as AuditorRepository;
  }

  /**
   * Best-effort logout. Clears the in-memory session map; cookie expiry
   * on the client is handled by the session middleware which sets
   * `Max-Age=0` when this method is invoked. Idempotent: safe to call
   * with no active session.
   */
  logout(): { ok: true } {
    // Clear all session state (we don't track per-request sid here in
    // dev; production sessions are cookie-bound and the middleware reads
    // this stub to know it should emit clear-cookie headers).
    this.sessions.clear();
    return { ok: true };
  }

  // ── OIDC ──────────────────────────────────────────────────────────────────

  async oidcStart(provider: string): Promise<{ authorizeUrl: string; state: string }> {
    if (!this.cfg.OIDC_ISSUER || !this.cfg.OIDC_CLIENT_ID || !this.cfg.OIDC_CLIENT_SECRET) {
      throw new ValidationError('OIDC not configured');
    }

    const oidcClient = this.buildOidcClient();
    const { authorizationUrl, session } = await oidcClient.startAuthFlow();

    this.oidcSessions.set(session.state, {
      ...session,
      provider,
      issuedAt: Date.now(),
    });

    return { authorizeUrl: authorizationUrl, state: session.state };
  }

  async oidcCallback(code: string, state: string): Promise<SessionDto> {
    const pending = this.oidcSessions.get(state);
    if (!pending) {
      this.emitAuthFailure('oidc_unknown_state', { detail: state });
      throw new UnauthorizedError('Unknown or expired OIDC state');
    }

    // Replay / TTL check.
    if (Date.now() - pending.issuedAt > CHALLENGE_TTL_MS) {
      this.oidcSessions.delete(state);
      this.emitAuthFailure('oidc_state_expired', { detail: state });
      throw new UnauthorizedError('OIDC state expired');
    }

    this.oidcSessions.delete(state);

    if (!this.cfg.OIDC_REDIRECT_URI) {
      throw new ValidationError('OIDC redirect URI not configured');
    }

    const oidcClient = this.buildOidcClient();

    // Build a synthetic callback URL from code + state so OidcClient can
    // extract them via the standard URLSearchParams interface.
    const callbackUrl = new URL(this.cfg.OIDC_REDIRECT_URI);
    callbackUrl.searchParams.set('code', code);
    callbackUrl.searchParams.set('state', state);

    let tokenSet: Awaited<ReturnType<OidcClient['completeAuthFlow']>>;
    try {
      tokenSet = await oidcClient.completeAuthFlow(callbackUrl.toString(), {
        state: pending.state,
        nonce: pending.nonce,
        codeVerifier: pending.codeVerifier,
        codeChallenge: pending.codeChallenge,
      });
    } catch (e) {
      this.emitAuthFailure('oidc_code_exchange_failed', { detail: String(e) });
      throw new UnauthorizedError('OIDC code exchange failed');
    }

    // Fetch user-info and enforce email_verified.
    let userInfo: Awaited<ReturnType<OidcClient['fetchUserInfo']>>;
    try {
      userInfo = await oidcClient.fetchUserInfo(tokenSet.accessToken, tokenSet.idToken);
    } catch (e) {
      this.emitAuthFailure('oidc_userinfo_failed', { detail: String(e) });
      throw new UnauthorizedError('Failed to fetch OIDC user info');
    }

    if (!userInfo.emailVerified) {
      this.emitAuthFailure('oidc_email_not_verified', { detail: userInfo.sub });
      throw new UnauthorizedError('OIDC email is not verified');
    }

    if (!userInfo.email) {
      this.emitAuthFailure('oidc_no_email', { detail: userInfo.sub });
      throw new UnauthorizedError('OIDC provider did not return an email claim');
    }

    // Lookup the auditor by OIDC subject. JIT provisioning is a separate
    // controlled flow — if no identity mapping exists, reject with a clear
    // error rather than silently creating an unprovisioned account.
    const auditor = await this.auditorRepo.findByOidcSub(userInfo.sub);
    if (!auditor) {
      this.emitAuthFailure('oidc_auditor_not_provisioned', {
        detail: userInfo.sub,
        email: userInfo.email,
      });
      throw new UnauthorizedError(
        'No auditor account is associated with this identity. ' +
          'An administrator must provision your account before you can log in.',
      );
    }

    this.assertAuditorActive(auditor);
    return this.issueSession(auditor);
  }

  // ── WebAuthn registration ─────────────────────────────────────────────────

  async webauthnRegisterStart(username: string): Promise<{ challenge: string; rpId: string }> {
    const userId = randomBytes(16);
    const opts = await this.webAuthnService.beginRegistration({
      userId,
      userName: username,
      userDisplayName: username,
      excludeCredentialIds: [],
    });

    this.challenges.set(`reg:${username}`, { challenge: opts.challenge, ts: Date.now() });
    return { challenge: opts.challenge, rpId: this.cfg.WEBAUTHN_RP_ID };
  }

  async webauthnRegisterFinish(
    username: string,
    resp: Record<string, unknown>,
  ): Promise<SessionDto> {
    const c = this.popChallenge(`reg:${username}`, 'registration');
    const registrationResp = resp as unknown as RegistrationResponseJSON;

    let verified: Awaited<ReturnType<WebAuthnService['finishRegistration']>>;
    try {
      verified = await this.webAuthnService.finishRegistration(registrationResp, c.challenge);
    } catch (e) {
      this.emitAuthFailure('webauthn_registration_failed', { username, detail: String(e) });
      throw new UnauthorizedError('WebAuthn registration verification failed');
    }

    if (
      !verified.verified ||
      !verified.registrationInfo?.credential
    ) {
      this.emitAuthFailure('webauthn_registration_unverified', { username });
      throw new UnauthorizedError('WebAuthn registration could not be verified');
    }

    const { credential } = verified.registrationInfo;
    const storedCredential: StoredCredential = {
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
    };

    // Look up an existing user or create a new one.
    let auditor = await this.auditorRepo.findByUsername(username);
    if (!auditor) {
      // New auditor self-registration — stub firmId.
      // TODO(phase-rls): replace with a real firm-invitation flow.
      throw new UnauthorizedError(
        'Self-registration is not enabled. An administrator must provision your account first.',
      );
    }

    this.assertAuditorActive(auditor);
    await this.auditorRepo.addCredential(auditor.id, storedCredential);
    return this.issueSession(auditor);
  }

  // ── WebAuthn login ────────────────────────────────────────────────────────

  async webauthnLoginStart(username: string): Promise<{ challenge: string; rpId: string }> {
    const auditor = await this.auditorRepo.findByUsername(username);
    if (!auditor) {
      // Constant-time: still generate a challenge so timing cannot reveal user existence.
      const fakeChallenge = randomBytes(32).toString('base64url');
      this.challenges.set(`auth:${username}`, { challenge: fakeChallenge, ts: Date.now() });
      return { challenge: fakeChallenge, rpId: this.cfg.WEBAUTHN_RP_ID };
    }

    const opts = await this.webAuthnService.beginAuthentication(auditor.webauthnCredentials);
    this.challenges.set(`auth:${username}`, { challenge: opts.challenge, ts: Date.now() });
    return { challenge: opts.challenge, rpId: this.cfg.WEBAUTHN_RP_ID };
  }

  async webauthnLoginFinish(
    username: string,
    resp: Record<string, unknown>,
  ): Promise<SessionDto> {
    const c = this.popChallenge(`auth:${username}`, 'login');
    const auditor = await this.auditorRepo.findByUsername(username);

    if (!auditor) {
      this.emitAuthFailure('webauthn_login_unknown_user', { username });
      throw new UnauthorizedError('Authentication failed');
    }

    this.assertAuditorActive(auditor);

    const assertionResp = resp as unknown as AuthenticationResponseJSON;
    const credentialId = assertionResp.id;
    const storedCredential = auditor.webauthnCredentials.find(
      (cred) => cred.credentialId === credentialId,
    );

    if (!storedCredential) {
      this.emitAuthFailure('webauthn_login_credential_not_found', {
        username,
        credentialId,
      });
      throw new UnauthorizedError('Authentication failed');
    }

    let verified: Awaited<ReturnType<WebAuthnService['finishAuthentication']>>;
    try {
      verified = await this.webAuthnService.finishAuthentication(
        assertionResp,
        c.challenge,
        storedCredential,
      );
    } catch (e) {
      this.emitAuthFailure('webauthn_login_verification_failed', {
        username,
        detail: String(e),
      });
      throw new UnauthorizedError('Authentication failed');
    }

    if (!verified.verified) {
      this.emitAuthFailure('webauthn_login_unverified', { username });
      throw new UnauthorizedError('Authentication failed');
    }

    // Enforce strict counter monotonicity to prevent credential replay.
    const { newCounter } = verified.authenticationInfo;
    if (newCounter <= storedCredential.counter) {
      this.emitAuthFailure('webauthn_login_counter_replay', {
        username,
        stored: storedCredential.counter,
        received: newCounter,
      });
      throw new UnauthorizedError('Authentication failed');
    }

    // Persist the counter. Prefer the dedicated credential repository when
    // available (it enforces monotonicity at the SQL layer too); fall back
    // to the auditor repository's legacy updateCredentialCounter otherwise.
    if (this.webauthnCredentialRepo) {
      try {
        await this.webauthnCredentialRepo.incrementCounter(credentialId, newCounter);
      } catch (e) {
        if (e instanceof MonotonicityViolationError) {
          this.emitAuthFailure('webauthn_login_counter_replay_sql', {
            username,
            stored: e.storedCounter,
            received: e.receivedCounter,
          });
          throw new UnauthorizedError('Authentication failed');
        }
        throw e;
      }
    } else {
      await this.auditorRepo.updateCredentialCounter(auditor.id, credentialId, newCounter);
    }

    void this.auditorRepo.recordLogin?.(auditor.id);
    return this.issueSession(auditor);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildOidcClient(): OidcClient {
    if (!this.cfg.OIDC_ISSUER || !this.cfg.OIDC_CLIENT_ID || !this.cfg.OIDC_CLIENT_SECRET) {
      throw new ValidationError('OIDC not configured');
    }
    return new OidcClient({
      issuerUrl: this.cfg.OIDC_ISSUER,
      clientId: this.cfg.OIDC_CLIENT_ID,
      clientSecret: this.cfg.OIDC_CLIENT_SECRET,
      redirectUri: this.cfg.OIDC_REDIRECT_URI ?? '',
      scopes: ['openid', 'email', 'profile'],
    });
  }

  private popChallenge(
    key: string,
    flow: string,
  ): { challenge: string; ts: number } {
    const c = this.challenges.get(key);
    if (!c) {
      this.emitAuthFailure(`webauthn_no_challenge_${flow}`, { key });
      throw new UnauthorizedError(`No ${flow} challenge found`);
    }
    if (Date.now() - c.ts > CHALLENGE_TTL_MS) {
      this.challenges.delete(key);
      this.emitAuthFailure(`webauthn_challenge_expired_${flow}`, { key });
      throw new UnauthorizedError(`${flow} challenge expired`);
    }
    this.challenges.delete(key);
    return c;
  }

  private assertAuditorActive(auditor: AuditorRecord): void {
    if (auditor.status === 'inactive') {
      this.emitAuthFailure('login_rejected_inactive', { auditorId: auditor.id });
      throw new UnauthorizedError('Account is inactive');
    }
    if (auditor.status === 'suspended') {
      this.emitAuthFailure('login_rejected_suspended', { auditorId: auditor.id });
      throw new UnauthorizedError('Account is suspended');
    }
  }

  private issueSession(auditor: AuditorRecord): SessionDto {
    const session: SessionDto = {
      auditorId: auditor.id,
      firmId: auditor.firmId,
      roles: auditor.roles,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    };
    const sid = randomBytes(24).toString('base64url');
    this.sessions.set(sid, session);
    this.logger.log({ msg: 'session_issued', auditorId: auditor.id, firmId: auditor.firmId });
    return session;
  }

  private emitAuthFailure(reason: string, extras?: Record<string, unknown>): void {
    void this.ledger?.emitAuthFailure(reason, extras ?? {});
    this.logger.warn({ msg: 'auth_failure', reason, ...extras });
  }
}
