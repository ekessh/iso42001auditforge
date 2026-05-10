// SPDX-License-Identifier: BUSL-1.1
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/types';

export interface WebAuthnConfig {
  rpName: string;
  rpId: string;
  origin: string | string[];
}

export interface StoredCredential {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  deviceLabel?: string;
}

export interface RegistrationRequestInput {
  userId: Uint8Array;
  userName: string;
  userDisplayName: string;
  excludeCredentialIds?: string[];
}

export class WebAuthnService {
  constructor(private readonly config: WebAuthnConfig) {}

  async beginRegistration(
    input: RegistrationRequestInput,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpId,
      userID: input.userId,
      userName: input.userName,
      userDisplayName: input.userDisplayName,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'cross-platform',
      },
      excludeCredentials: (input.excludeCredentialIds ?? []).map((id) => ({ id })),
      supportedAlgorithmIDs: [-7, -257],
    });
  }

  async finishRegistration(
    response: RegistrationResponseJSON,
    expectedChallenge: string,
  ): Promise<VerifiedRegistrationResponse> {
    return verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.config.origin,
      expectedRPID: this.config.rpId,
      requireUserVerification: true,
    });
  }

  async beginAuthentication(
    allowCredentials: StoredCredential[] = [],
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return generateAuthenticationOptions({
      rpID: this.config.rpId,
      userVerification: 'required',
      allowCredentials: allowCredentials.map((c) => ({
        id: c.credentialId,
        ...(c.transports !== undefined ? { transports: c.transports } : {}),
      })),
    });
  }

  async finishAuthentication(
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
    credential: StoredCredential,
  ): Promise<VerifiedAuthenticationResponse> {
    return verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.config.origin,
      expectedRPID: this.config.rpId,
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        ...(credential.transports !== undefined ? { transports: credential.transports } : {}),
      },
    });
  }
}
