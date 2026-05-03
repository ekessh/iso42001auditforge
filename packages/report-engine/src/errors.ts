// SPDX-License-Identifier: BUSL-1.1

/**
 * Base class for report-engine errors. We deliberately do not depend on
 * `@auditforge/shared` error classes here so that the engine can be used by
 * tests that mock the rest of the workspace.
 */
export class ReportEngineError extends Error {
  override readonly name: string = 'ReportEngineError';
}

export class TemplateRenderError extends ReportEngineError {
  override readonly name = 'TemplateRenderError';
  constructor(
    message: string,
    public readonly path: string,
    public readonly line: number,
  ) {
    super(`${message} (path=${path} line=${line})`);
  }
}

export class TemplateValidationError extends ReportEngineError {
  override readonly name = 'TemplateValidationError';
}

export class SignatureError extends ReportEngineError {
  override readonly name = 'SignatureError';
}

export class VerificationError extends ReportEngineError {
  override readonly name = 'VerificationError';
}

export class ImmutableFinalError extends ReportEngineError {
  override readonly name = 'ImmutableFinalError';
}
