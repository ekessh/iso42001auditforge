// SPDX-License-Identifier: BUSL-1.1
import { NotFoundError, ValidationError } from '@auditforge/shared';
import {
  WpTemplateSchema,
  type WpTemplate,
  type WpTemplateInput,
} from './domain.js';

/**
 * In-memory template registry. The actual JSON template files ship under
 * `packages/working-papers/templates/`; an upstream loader (NestJS) reads them
 * at startup and feeds the registry. Per-CB customizations layer on top via
 * `customize`.
 */
export class TemplateRegistry {
  private readonly templates = new Map<string, WpTemplate>();
  /** firmId -> templateId -> customized template */
  private readonly customizations = new Map<string, Map<string, WpTemplate>>();

  register(input: WpTemplateInput): WpTemplate {
    const parsed = WpTemplateSchema.parse(input);
    const key = templateKey(parsed.id, parsed.version);
    this.templates.set(key, parsed);
    return parsed;
  }

  registerMany(inputs: readonly WpTemplateInput[]): WpTemplate[] {
    return inputs.map((i) => this.register(i));
  }

  size(): number {
    return this.templates.size;
  }

  list(): WpTemplate[] {
    return [...this.templates.values()];
  }

  /** Fetch a template by id+version, optionally resolving CB customization. */
  get(
    id: string,
    version: string,
    firmId?: string | undefined,
  ): WpTemplate {
    if (firmId) {
      const cb = this.customizations.get(firmId);
      const custom = cb?.get(templateKey(id, version));
      if (custom) return custom;
    }
    const t = this.templates.get(templateKey(id, version));
    if (!t) {
      throw new NotFoundError('WpTemplate', `${id}@${version}`);
    }
    return t;
  }

  /**
   * Per-CB customization. The customization MUST keep the same id/version pair
   * as the base template; only descriptive content can change. This prevents
   * a CB from silently swapping a template with an unrelated one.
   */
  customize(firmId: string, input: WpTemplateInput): WpTemplate {
    const parsed = WpTemplateSchema.parse(input);
    if (!this.templates.has(templateKey(parsed.id, parsed.version))) {
      throw new NotFoundError(
        'WpTemplate',
        `${parsed.id}@${parsed.version} (cannot customize unknown base)`,
      );
    }
    let cb = this.customizations.get(firmId);
    if (!cb) {
      cb = new Map();
      this.customizations.set(firmId, cb);
    }
    cb.set(templateKey(parsed.id, parsed.version), parsed);
    return parsed;
  }

  /** Remove a CB-level customization without affecting the base template. */
  removeCustomization(firmId: string, id: string, version: string): boolean {
    const cb = this.customizations.get(firmId);
    if (!cb) return false;
    return cb.delete(templateKey(id, version));
  }
}

function templateKey(id: string, version: string): string {
  return `${id}@${version}`;
}

const VARIABLE_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Variable substitution. Resolves `{{a.b.c}}` style placeholders against a
 * nested object. Unresolved variables throw `ValidationError` so a missing
 * substitution never silently leaks the placeholder into a working paper.
 */
export function renderTemplateString(
  source: string,
  vars: Record<string, unknown>,
): string {
  return source.replace(VARIABLE_RE, (_match, path: string) => {
    const value = lookupPath(vars, path);
    if (value === undefined || value === null) {
      throw new ValidationError(`Unresolved template variable: ${path}`, {
        path,
      });
    }
    return String(value);
  });
}

/**
 * Render every prompt / checklist / suggested-question string against a
 * variables object, returning a fully materialized template the editor can
 * surface to the auditor.
 */
export function renderTemplate(
  template: WpTemplate,
  vars: Record<string, unknown>,
): WpTemplate {
  return {
    ...template,
    description: renderTemplateString(template.description, vars),
    sections: template.sections.map((s) => ({
      ...s,
      title: renderTemplateString(s.title, vars),
      prompts: s.prompts.map((p) => renderTemplateString(p, vars)),
    })),
    checklists: template.checklists.map((c) => ({
      ...c,
      text: renderTemplateString(c.text, vars),
      ...(c.guidance !== undefined
        ? { guidance: renderTemplateString(c.guidance, vars) }
        : {}),
    })),
    suggestedInterviewQuestions: template.suggestedInterviewQuestions.map((q) =>
      renderTemplateString(q, vars),
    ),
  };
}

function lookupPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
