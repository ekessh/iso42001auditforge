// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller.js';
import { IdentityService, AUDITOR_REPOSITORY } from './identity.service.js';
import {
  DrizzleAuditorRepository,
  AUDITOR_REPO_LEDGER_SINK,
} from './auditor.repository.js';
import {
  DrizzleWebAuthnCredentialRepository,
  WEBAUTHN_CREDENTIAL_REPOSITORY,
  WEBAUTHN_LEDGER_SINK,
} from '../../common/webauthn-credential.repository.js';
import { LEDGER_SINK } from '../../common/auth.guard.js';

@Module({
  controllers: [IdentityController],
  providers: [
    IdentityService,

    // ── AuditorRepository ───────────────────────────────────────────────────
    DrizzleAuditorRepository,
    {
      provide: AUDITOR_REPOSITORY,
      useExisting: DrizzleAuditorRepository,
    },
    // Wire the ledger sink into the auditor repository. The identity module
    // re-uses the global LEDGER_SINK token so the same AuditLedgerModule
    // sink is used for all auth-failure events.
    {
      provide: AUDITOR_REPO_LEDGER_SINK,
      useExisting: LEDGER_SINK,
    },

    // ── WebAuthnCredentialRepository ────────────────────────────────────────
    DrizzleWebAuthnCredentialRepository,
    {
      provide: WEBAUTHN_CREDENTIAL_REPOSITORY,
      useExisting: DrizzleWebAuthnCredentialRepository,
    },
    {
      provide: WEBAUTHN_LEDGER_SINK,
      useExisting: LEDGER_SINK,
    },
  ],
  exports: [IdentityService, WEBAUTHN_CREDENTIAL_REPOSITORY],
})
export class IdentityModule {}
