// SPDX-License-Identifier: BUSL-1.1
import { Global, Module } from '@nestjs/common';
import { type AppConfig, loadConfig } from './config.schema.js';

export const APP_CONFIG = Symbol.for('AuditForge.AppConfig');

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
