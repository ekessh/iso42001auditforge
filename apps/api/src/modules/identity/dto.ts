// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const OidcStartSchema = z.object({
  provider: z.string().min(1),
  redirectUri: z.string().url().optional(),
});
export type OidcStartDto = z.infer<typeof OidcStartSchema>;

export const OidcCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  /** Full callback URL is needed to complete PKCE flow. */
  callbackUrl: z.string().url().optional(),
});
export type OidcCallbackDto = z.infer<typeof OidcCallbackSchema>;

export const WebAuthnRegisterStartSchema = z.object({
  username: z.string().min(1).max(200),
});
export type WebAuthnRegisterStartDto = z.infer<typeof WebAuthnRegisterStartSchema>;

export const WebAuthnRegisterFinishSchema = z.object({
  username: z.string().min(1).max(200),
  attestationResponse: z.record(z.unknown()),
});
export type WebAuthnRegisterFinishDto = z.infer<typeof WebAuthnRegisterFinishSchema>;

export const WebAuthnLoginStartSchema = z.object({
  username: z.string().min(1).max(200),
});
export type WebAuthnLoginStartDto = z.infer<typeof WebAuthnLoginStartSchema>;

export const WebAuthnLoginFinishSchema = z.object({
  username: z.string().min(1).max(200),
  assertionResponse: z.record(z.unknown()),
});
export type WebAuthnLoginFinishDto = z.infer<typeof WebAuthnLoginFinishSchema>;

export class SessionDto {
  @ApiProperty() auditorId!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty({ type: [String] }) roles!: string[];
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

export class ChallengeDto {
  @ApiProperty() challenge!: string;
  @ApiProperty() rpId!: string;
}
