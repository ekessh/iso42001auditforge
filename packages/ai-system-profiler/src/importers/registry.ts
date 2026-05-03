// SPDX-License-Identifier: BUSL-1.1
import { ConfigurationError } from '../compat/shared.js';
import type { AiSystemImporter, ImporterFormat } from './types.js';

class ConfigError extends ConfigurationError {}

/**
 * ImporterRegistry — pluggable lookup for {@link AiSystemImporter}s.
 * Apps/api wires the production importers at boot; tests use ad-hoc
 * mocks. New importers (e.g., Sagemaker, Vertex, Azure ML) plug in
 * without modifying the profiler core.
 */
export class ImporterRegistry {
  private readonly map = new Map<ImporterFormat, AiSystemImporter<unknown>>();

  register<T>(format: ImporterFormat, importer: AiSystemImporter<T>): void {
    this.map.set(format, importer as AiSystemImporter<unknown>);
  }

  unregister(format: ImporterFormat): void {
    this.map.delete(format);
  }

  has(format: ImporterFormat): boolean {
    return this.map.has(format);
  }

  get<T = unknown>(format: ImporterFormat): AiSystemImporter<T> {
    const im = this.map.get(format);
    if (!im) throw new ConfigError(`No importer registered for format: ${format}`);
    return im as AiSystemImporter<T>;
  }

  list(): readonly ImporterFormat[] {
    return [...this.map.keys()];
  }
}
