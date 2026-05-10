// SPDX-License-Identifier: BUSL-1.1
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { ValidationError } from './errors.js';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationError('Request validation failed', { issues: result.error.flatten() });
    }
    return result.data;
  }
}
