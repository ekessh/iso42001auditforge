// SPDX-License-Identifier: BUSL-1.1
import { Global, Module } from '@nestjs/common';
import { Client as MinioClient } from 'minio';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { StorageService } from './storage.service.js';

export const MINIO = Symbol.for('AuditForge.Minio');

@Global()
@Module({
  providers: [
    {
      provide: MINIO,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig): MinioClient => {
        const url = new URL(cfg.S3_ENDPOINT);
        return new MinioClient({
          endPoint: url.hostname,
          port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
          useSSL: url.protocol === 'https:',
          accessKey: cfg.S3_ACCESS_KEY,
          secretKey: cfg.S3_SECRET_KEY,
          region: cfg.S3_REGION,
        });
      },
    },
    StorageService,
  ],
  exports: [MINIO, StorageService],
})
export class StorageModule {}
