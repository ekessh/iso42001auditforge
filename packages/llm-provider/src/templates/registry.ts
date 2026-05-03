// SPDX-License-Identifier: BUSL-1.1
import { createHash } from 'node:crypto';
import { TemplateMismatch } from '../errors.js';

export interface PromptTemplate {
  version: string;
  body: string;
  hash: string;
}

export class PromptTemplateRegistry {
  private readonly templates = new Map<string, PromptTemplate>();
  private readonly mismatches: Array<{
    declaredVersion: string;
    registryVersion: string | null;
    at: string;
  }> = [];

  register(version: string, body: string): PromptTemplate {
    if (this.templates.has(version)) {
      throw new Error(`prompt template already registered: ${version}`);
    }
    const hash = createHash('sha256').update(body).digest('hex');
    const t: PromptTemplate = { version, body, hash };
    this.templates.set(version, t);
    return t;
  }

  has(version: string): boolean {
    return this.templates.has(version);
  }

  get(version: string): PromptTemplate {
    const t = this.templates.get(version);
    if (!t) {
      this.mismatches.push({
        declaredVersion: version,
        registryVersion: null,
        at: new Date().toISOString(),
      });
      throw new TemplateMismatch(version, null);
    }
    return t;
  }

  ensure(version: string): PromptTemplate {
    return this.get(version);
  }

  hashOf(version: string): string {
    return this.ensure(version).hash;
  }

  recordedMismatches(): readonly {
    declaredVersion: string;
    registryVersion: string | null;
    at: string;
  }[] {
    return [...this.mismatches];
  }
}
