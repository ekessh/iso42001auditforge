// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, apiFetchRaw, type ApiFetchOptions } from './fetcher.js';

export const SessionSchema = z.object({
  auditorId: z.string(),
  firmId: z.string(),
  roles: z.array(z.string()).default([]),
  expiresAt: z.string(),
  /** Optional convenience fields when API enriches the session response. */
  name: z.string().optional(),
  firmName: z.string().optional(),
});
export type Session = z.infer<typeof SessionSchema>;

export const ChallengeSchema = z.object({
  challenge: z.string(),
  rpId: z.string(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export const WebAuthnRegistrationOptionsSchema = z.object({
  publicKey: z.record(z.unknown()),
  rpId: z.string().optional(),
});

export const WebAuthnAuthenticationOptionsSchema = z.object({
  publicKey: z.record(z.unknown()),
  rpId: z.string().optional(),
});

export interface WebAuthnStartInput {
  username: string;
}

export function webauthnRegisterStart(
  input: WebAuthnStartInput,
  options: ApiFetchOptions = {},
) {
  return apiFetchRaw<unknown>('/identity/webauthn/register/start', {
    ...options,
    method: 'POST',
    body: input,
  });
}

export function webauthnRegisterFinish(
  input: { username: string; attestationResponse: unknown },
  options: ApiFetchOptions = {},
) {
  return apiFetch('/identity/webauthn/register/finish', SessionSchema, {
    ...options,
    method: 'POST',
    body: input,
  });
}

export function webauthnLoginStart(
  input: WebAuthnStartInput,
  options: ApiFetchOptions = {},
) {
  return apiFetchRaw<unknown>('/identity/webauthn/login/start', {
    ...options,
    method: 'POST',
    body: input,
  });
}

export function webauthnLoginFinish(
  input: { username: string; assertionResponse: unknown },
  options: ApiFetchOptions = {},
) {
  return apiFetch('/identity/webauthn/login/finish', SessionSchema, {
    ...options,
    method: 'POST',
    body: input,
  });
}

export function logout(options: ApiFetchOptions = {}) {
  return apiFetchRaw<void>('/identity/logout', {
    ...options,
    method: 'POST',
  });
}
