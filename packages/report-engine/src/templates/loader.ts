// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { ReportTemplateSchema, type ReportTemplate, type ReportType } from '../domain.js';
import { TemplateValidationError } from '../errors.js';

/**
 * Loads a JSON template payload and validates it against the
 * `ReportTemplate` schema. The host injects the JSON (read from disk, fetched
 * over HTTP, or embedded). This keeps the package free of `fs`-binding so it
 * works in browser/Electron contexts.
 */
export function parseTemplate(json: unknown): ReportTemplate {
  const result = ReportTemplateSchema.safeParse(json);
  if (!result.success) {
    throw new TemplateValidationError(
      `Invalid template: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  return result.data;
}

/**
 * Compile the declarative `variables` block into a Zod schema for strict
 * runtime validation of the variable bag passed by the API.
 */
export function compileVariableSchema(template: ReportTemplate): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [name, decl] of Object.entries(template.variables)) {
    let typeSchema: z.ZodTypeAny;
    switch (decl.type) {
      case 'string':
        typeSchema = z.string();
        break;
      case 'date':
        typeSchema = z.union([z.string(), z.date()]);
        break;
      case 'number':
        typeSchema = z.number();
        break;
      case 'boolean':
        typeSchema = z.boolean();
        break;
      case 'array':
        typeSchema = z.array(z.unknown());
        break;
      case 'object':
        typeSchema = z.record(z.unknown());
        break;
      default:
        typeSchema = z.unknown();
    }
    shape[name] = decl.required ? typeSchema : typeSchema.optional();
  }
  return z.object(shape).passthrough();
}

export function validateVariables(
  template: ReportTemplate,
  variables: Record<string, unknown>,
): Record<string, unknown> {
  const schema = compileVariableSchema(template);
  const result = schema.safeParse(variables);
  if (!result.success) {
    throw new TemplateValidationError(
      `Invalid variables for template ${template.id}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  return result.data;
}

export interface TemplateRegistry {
  list(): readonly ReportTemplate[];
  get(id: string): ReportTemplate;
  byType(type: ReportType): ReportTemplate;
}

export function createRegistry(templates: readonly ReportTemplate[]): TemplateRegistry {
  const byId = new Map<string, ReportTemplate>();
  const byType = new Map<ReportType, ReportTemplate>();
  for (const t of templates) {
    byId.set(t.id, t);
    if (!byType.has(t.type)) byType.set(t.type, t);
  }
  return {
    list: () => [...templates],
    get(id) {
      const t = byId.get(id);
      if (t === undefined) throw new TemplateValidationError(`Unknown template: ${id}`);
      return t;
    },
    byType(type) {
      const t = byType.get(type);
      if (t === undefined) throw new TemplateValidationError(`No template registered for type: ${type}`);
      return t;
    },
  };
}
