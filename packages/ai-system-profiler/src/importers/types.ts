// SPDX-License-Identifier: BUSL-1.1
import type { AiSystemCreateInput } from '../types/ai-system.js';
import type { ValidationReport } from '../types/validation.js';

/** Source format identifier. */
export type ImporterFormat =
  | 'xlsx'
  | 'json'
  | 'mlflow'
  | 'wandb'
  | 'huggingface'
  | 'openapi';

/**
 * Importer contract — every importer accepts a typed input and returns a
 * normalised list of `AiSystemCreateInput` records (suitable for
 * `AiSystemRegistry.create`) plus a {@link ValidationReport}.
 *
 * The importers never call the registry themselves — the consumer
 * (apps/api Phase 2 wizard) is responsible for tenanted persistence so
 * the same importer can be used for dry-runs and previews.
 */
export interface AiSystemImporter<TInput> {
  readonly format: ImporterFormat;
  import(input: TInput): Promise<{
    systems: readonly AiSystemCreateInput[];
    report: ValidationReport;
  }>;
}
