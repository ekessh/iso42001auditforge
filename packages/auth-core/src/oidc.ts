// SPDX-License-Identifier: BUSL-1.1
import * as oidc from 'openid-client';
import { ConfigurationError } from '@auditforge/shared';

export interface OidcConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: readonly string[];
}

export interface OidcSession {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
}

export interface OidcTokenSet {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
  tokenType: string;
  scope?: string;
}

export interface OidcUserInfo {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  preferredUsername?: string;
}

export class OidcClient {
  private config: oidc.Configuration | undefined;

  constructor(private readonly settings: OidcConfig) {}

  private async ensureConfig(): Promise<oidc.Configuration> {
    if (!this.config) {
      try {
        this.config = await oidc.discovery(
          new URL(this.settings.issuerUrl),
          this.settings.clientId,
          this.settings.clientSecret,
        );
      } catch (e) {
        throw new ConfigurationError(`OIDC discovery failed for ${this.settings.issuerUrl}`, { cause: String(e) });
      }
    }
    return this.config;
  }

  async startAuthFlow(): Promise<{ authorizationUrl: string; session: OidcSession }> {
    const config = await this.ensureConfig();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();

    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.settings.redirectUri,
      scope: this.settings.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    return {
      authorizationUrl: url.toString(),
      session: { state, nonce, codeVerifier, codeChallenge },
    };
  }

  async completeAuthFlow(
    callbackUrl: string,
    session: OidcSession,
  ): Promise<OidcTokenSet> {
    const config = await this.ensureConfig();
    const tokens = await oidc.authorizationCodeGrant(config, new URL(callbackUrl), {
      pkceCodeVerifier: session.codeVerifier,
      expectedState: session.state,
      expectedNonce: session.nonce,
    });

    if (!tokens.id_token) {
      throw new ConfigurationError('OIDC response missing id_token');
    }
    return {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      ...(tokens.refresh_token !== undefined ? { refreshToken: tokens.refresh_token } : {}),
      expiresInSeconds: tokens.expires_in ?? 0,
      tokenType: tokens.token_type ?? 'Bearer',
      ...(tokens.scope !== undefined ? { scope: tokens.scope } : {}),
    };
  }

  async refresh(refreshToken: string): Promise<OidcTokenSet> {
    const config = await this.ensureConfig();
    const tokens = await oidc.refreshTokenGrant(config, refreshToken);
    if (!tokens.id_token) {
      throw new ConfigurationError('OIDC refresh response missing id_token');
    }
    return {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      expiresInSeconds: tokens.expires_in ?? 0,
      tokenType: tokens.token_type ?? 'Bearer',
      ...(tokens.scope !== undefined ? { scope: tokens.scope } : {}),
    };
  }

  async fetchUserInfo(accessToken: string, expectedSubject: string): Promise<OidcUserInfo> {
    const config = await this.ensureConfig();
    const claims = await oidc.fetchUserInfo(config, accessToken, expectedSubject);
    return {
      sub: claims.sub,
      ...(typeof claims.email === 'string' ? { email: claims.email } : {}),
      ...(typeof claims.email_verified === 'boolean' ? { emailVerified: claims.email_verified } : {}),
      ...(typeof claims.name === 'string' ? { name: claims.name } : {}),
      ...(typeof claims.preferred_username === 'string' ? { preferredUsername: claims.preferred_username } : {}),
    };
  }
}
