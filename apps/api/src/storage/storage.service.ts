// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable } from '@nestjs/common';
import { Client as MinioClient } from 'minio';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import { MINIO } from './storage.tokens.js';

export interface PresignedUpload {
  uploadId: string;
  bucket: string;
  objectKey: string;
  url: string;
  expiresAt: string;
}

@Injectable()
export class StorageService {
  constructor(
    @Inject(MINIO) private readonly minio: MinioClient,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  async presignUpload(firmId: string, filename: string, ttlSeconds = 900): Promise<PresignedUpload> {
    const bucket = this.cfg.S3_BUCKET;
    const uploadId = randomUUID();
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `firm/${firmId}/uploads/${uploadId}/${safe}`;
    const url = await this.minio.presignedPutObject(bucket, objectKey, ttlSeconds);
    return {
      uploadId,
      bucket,
      objectKey,
      url,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  async presignDownload(bucket: string, objectKey: string, ttlSeconds = 300): Promise<string> {
    return this.minio.presignedGetObject(bucket, objectKey, ttlSeconds);
  }
}
