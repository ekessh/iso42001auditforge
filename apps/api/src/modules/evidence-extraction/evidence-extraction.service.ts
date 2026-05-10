// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ZodType } from 'zod';
import {
  BUNDLED_SCHEMAS,
  StubVlmProvider,
  buildExtractionEvent,
  imageSha256Hex,
  type BundledSchemaId,
  type VlmExtractor,
} from '@auditforge/vlm-extraction';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/config.schema.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { StorageService } from '../../storage/storage.service.js';
import type { ExtractEvidenceDto, ExtractedFieldDto } from './dto.js';

@Injectable()
export class EvidenceExtractionService {
  private readonly logger = new Logger(EvidenceExtractionService.name);
  private readonly extractor: VlmExtractor = new StubVlmProvider();
  private readonly cache = new Map<string, ExtractedFieldDto>();

  constructor(
    private readonly engine: AuditEngineAdapter,
    private readonly storage: StorageService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  async extract(firmId: string, dto: ExtractEvidenceDto): Promise<ExtractedFieldDto> {
    const image = decodeBase64(dto.imageBase64);
    const schema = BUNDLED_SCHEMAS[dto.schemaId as BundledSchemaId] as ZodType<unknown>;
    const id = randomUUID();
    const imageHash = imageSha256Hex(image);
    await this.engine.append({
      firmId,
      ...(dto.engagementId !== undefined ? { engagementId: dto.engagementId } : {}),
      actorId: 'system',
      type: 'evidence.extraction.requested',
      entity: 'evidence_extraction',
      entityId: id,
      payload: {
        schemaId: dto.schemaId,
        imageHash,
        imageMimeType: dto.imageMimeType,
      },
    });
    let stored = false;
    try {
      const presigned = await this.storage.presignUpload(firmId, `extraction-${id}.bin`);
      stored = Boolean(presigned.objectKey);
    } catch (err) {
      this.logger.warn(`storage presign failed: ${(err as Error).message}`);
    }
    const result = await this.extractor.extract(image, schema, {
      schemaId: dto.schemaId,
      ...(dto.engagementId !== undefined ? { engagementId: dto.engagementId } : {}),
      redactPii: dto.redactPii,
    });
    const event = buildExtractionEvent(dto.schemaId, image, result, dto.engagementId);
    await this.engine.append({
      firmId,
      ...(dto.engagementId !== undefined ? { engagementId: dto.engagementId } : {}),
      actorId: 'system',
      type: 'evidence.extraction.completed',
      entity: 'evidence_extraction',
      entityId: id,
      payload: {
        ...event,
        stored,
        bucket: this.cfg.S3_BUCKET,
      },
    });
    const out: ExtractedFieldDto = {
      id,
      schemaId: dto.schemaId,
      confidence: result.confidence,
      modelName: result.modelName,
      ...(result.modelHash !== undefined ? { modelHash: result.modelHash } : {}),
      imageHash,
      extractedAt: result.extractedAt,
      ...(dto.engagementId !== undefined ? { engagementId: dto.engagementId } : {}),
      value: result.value as Record<string, unknown>,
    };
    this.cache.set(id, out);
    return out;
  }

  get(firmId: string, id: string): ExtractedFieldDto | null {
    void firmId;
    return this.cache.get(id) ?? null;
  }
}

function decodeBase64(s: string): Uint8Array {
  const buf = Buffer.from(s, 'base64');
  return new Uint8Array(buf);
}
