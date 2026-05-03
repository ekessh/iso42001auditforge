// SPDX-License-Identifier: BUSL-1.1
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { AuthenticationError } from '@auditforge/shared';

export interface JwtSignOptions {
  issuer: string;
  audience: string;
  subject: string;
  expiresInSeconds: number;
  jwtId: string;
  additionalClaims?: Record<string, unknown>;
}

export interface JwtVerifyOptions {
  issuer: string;
  audience: string;
  clockToleranceSeconds?: number;
}

export interface ReplayStore {
  has(jti: string): Promise<boolean>;
  remember(jti: string, expiresAtEpochSeconds: number): Promise<void>;
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly seen = new Map<string, number>();

  async has(jti: string): Promise<boolean> {
    const exp = this.seen.get(jti);
    if (exp === undefined) return false;
    if (exp <= Math.floor(Date.now() / 1000)) {
      this.seen.delete(jti);
      return false;
    }
    return true;
  }

  async remember(jti: string, expiresAtEpochSeconds: number): Promise<void> {
    this.seen.set(jti, expiresAtEpochSeconds);
  }
}

export async function signSessionToken(
  secret: Uint8Array,
  options: JwtSignOptions,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const builder = new SignJWT({ ...options.additionalClaims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + options.expiresInSeconds)
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setSubject(options.subject)
    .setJti(options.jwtId);
  return builder.sign(secret);
}

export interface VerifiedSessionToken {
  payload: JWTPayload;
  jti: string;
  exp: number;
  sub: string;
}

export async function verifySessionToken(
  secret: Uint8Array,
  token: string,
  options: JwtVerifyOptions,
  replayStore?: ReplayStore,
): Promise<VerifiedSessionToken> {
  let result;
  try {
    result = await jwtVerify(token, secret, {
      issuer: options.issuer,
      audience: options.audience,
      clockTolerance: options.clockToleranceSeconds ?? 5,
      algorithms: ['HS256'],
    });
  } catch (e) {
    throw new AuthenticationError('Invalid or expired token', { cause: String(e) });
  }
  const { payload } = result;
  const jti = payload.jti;
  const exp = payload.exp;
  const sub = payload.sub;
  if (typeof jti !== 'string' || typeof exp !== 'number' || typeof sub !== 'string') {
    throw new AuthenticationError('Token missing required claims');
  }
  if (replayStore) {
    if (await replayStore.has(jti)) {
      throw new AuthenticationError('Token replay rejected', { jti });
    }
    await replayStore.remember(jti, exp);
  }
  return { payload, jti, exp, sub };
}

export interface RotationHook {
  onSign(jti: string, sub: string, exp: number): Promise<void> | void;
  onRevoke(jti: string): Promise<void> | void;
}

export async function rotateSessionToken(
  secret: Uint8Array,
  options: JwtSignOptions,
  previousJti: string,
  hook: RotationHook,
): Promise<string> {
  await hook.onRevoke(previousJti);
  const fresh = await signSessionToken(secret, options);
  await hook.onSign(options.jwtId, options.subject, Math.floor(Date.now() / 1000) + options.expiresInSeconds);
  return fresh;
}
