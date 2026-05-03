// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { Public } from '../../common/auth.guard.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import {
  ChallengeDto,
  OidcCallbackSchema,
  OidcStartSchema,
  SessionDto,
  WebAuthnLoginFinishSchema,
  WebAuthnLoginStartSchema,
  WebAuthnRegisterFinishSchema,
  WebAuthnRegisterStartSchema,
  type OidcCallbackDto,
  type OidcStartDto,
  type WebAuthnLoginFinishDto,
  type WebAuthnLoginStartDto,
  type WebAuthnRegisterFinishDto,
  type WebAuthnRegisterStartDto,
} from './dto.js';
import { IdentityService } from './identity.service.js';

@ApiTags('identity')
@Controller({ path: 'identity', version: '1' })
export class IdentityController {
  constructor(private readonly svc: IdentityService) {}

  @Public()
  @Post('oidc/start')
  @UsePipes(new ZodValidationPipe(OidcStartSchema))
  @ApiOperation({ summary: 'Begin OIDC authorization' })
  @ApiOkResponse({ schema: { properties: { authorizeUrl: { type: 'string' }, state: { type: 'string' } } } })
  oidcStart(@Body() body: OidcStartDto): Promise<{ authorizeUrl: string; state: string }> {
    return this.svc.oidcStart(body.provider);
  }

  @Public()
  @Post('oidc/callback')
  @UsePipes(new ZodValidationPipe(OidcCallbackSchema))
  @ApiOkResponse({ type: SessionDto })
  oidcCallback(@Body() body: OidcCallbackDto): Promise<SessionDto> {
    return this.svc.oidcCallback(body.code, body.state);
  }

  @Public()
  @Post('webauthn/register/start')
  @UsePipes(new ZodValidationPipe(WebAuthnRegisterStartSchema))
  @ApiOkResponse({ type: ChallengeDto })
  webauthnRegisterStart(@Body() body: WebAuthnRegisterStartDto): Promise<ChallengeDto> {
    return this.svc.webauthnRegisterStart(body.username);
  }

  @Public()
  @Post('webauthn/register/finish')
  @UsePipes(new ZodValidationPipe(WebAuthnRegisterFinishSchema))
  @ApiCreatedResponse({ type: SessionDto })
  webauthnRegisterFinish(@Body() body: WebAuthnRegisterFinishDto): Promise<SessionDto> {
    return this.svc.webauthnRegisterFinish(body.username, body.attestationResponse);
  }

  @Public()
  @Post('webauthn/login/start')
  @UsePipes(new ZodValidationPipe(WebAuthnLoginStartSchema))
  @ApiOkResponse({ type: ChallengeDto })
  webauthnLoginStart(@Body() body: WebAuthnLoginStartDto): Promise<ChallengeDto> {
    return this.svc.webauthnLoginStart(body.username);
  }

  @Public()
  @Post('webauthn/login/finish')
  @UsePipes(new ZodValidationPipe(WebAuthnLoginFinishSchema))
  @ApiOkResponse({ type: SessionDto })
  webauthnLoginFinish(@Body() body: WebAuthnLoginFinishDto): Promise<SessionDto> {
    return this.svc.webauthnLoginFinish(body.username, body.assertionResponse);
  }
}
