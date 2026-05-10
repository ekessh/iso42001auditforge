// SPDX-License-Identifier: BUSL-1.1
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { TemplateMismatch } from '../errors.js';

export interface PromptTemplate {
  id?: string;
  version: string;
  body: string;
  hash: string;
  metadata?: Record<string, unknown>;
}

export interface PromptTemplateFile {
  id: string;
  version: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export class PromptTemplateRegistry {
  private readonly templates = new Map<string, PromptTemplate>();
  private readonly mismatches: Array<{
    declaredVersion: string;
    registryVersion: string | null;
    at: string;
  }> = [];

  register(version: string, body: string, opts: { id?: string; metadata?: Record<string, unknown> } = {}): PromptTemplate {
    if (this.templates.has(version)) {
      throw new Error(`prompt template already registered: ${version}`);
    }
    const hash = createHash('sha256').update(body).digest('hex');
    const t: PromptTemplate = { version, body, hash };
    if (opts.id !== undefined) t.id = opts.id;
    if (opts.metadata !== undefined) t.metadata = opts.metadata;
    this.templates.set(version, t);
    return t;
  }

  // WHY: load every *.json under a directory. The on-disk shape is
  // `{id, version, body, metadata?}`; we hash the body and pin the hash to
  // the recorded invocation so a tampered prompt template at runtime is
  // detectable from the audit ledger alone.
  loadFromDir(dir: string): readonly PromptTemplate[] {
    const out: PromptTemplate[] = [];
    const entries = readdirSync(dir);
    for (const e of entries) {
      const full = path.join(dir, e);
      const st = statSync(full);
      if (st.isDirectory()) {
        out.push(...this.loadFromDir(full));
        continue;
      }
      if (!e.endsWith('.json')) continue;
      const raw = readFileSync(full, 'utf-8');
      const parsed = JSON.parse(raw) as PromptTemplateFile;
      const opts: { id?: string; metadata?: Record<string, unknown> } = {};
      if (parsed.id !== undefined) opts.id = parsed.id;
      if (parsed.metadata !== undefined) opts.metadata = parsed.metadata;
      out.push(this.register(parsed.version, parsed.body, opts));
    }
    return out;
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

  list(): readonly PromptTemplate[] {
    return [...this.templates.values()];
  }
}
