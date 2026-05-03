// SPDX-License-Identifier: BUSL-1.1
/**
 * Tool fingerprint = sha256(name || description || serialized input schema).
 *
 * Tool fingerprints are pinned in tests. If a tool description changes between
 * server versions, every client that pinned the fingerprint must reconfirm —
 * which is the explicit defense against the Tool Poisoning Attack pattern
 * (P-MCP-01).
 */

import { createHash } from 'node:crypto';
import type { z } from 'zod';

interface ToolLike {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<unknown>;
}

export function fingerprintTool(tool: ToolLike): string {
  // We can't fully serialize a Zod schema portably, but we can serialize
  // the keys + descriptions of an object schema. For schemas that aren't
  // ZodObject, fall back to the typeName.
  const serializedSchema = serializeZod(tool.inputSchema);
  const payload = `${tool.name}\n${tool.description}\n${serializedSchema}`;
  return createHash('sha256').update(payload).digest('hex');
}

function serializeZod(s: z.ZodType<unknown>): string {
  const def = (s as unknown as { _def?: { typeName?: string; shape?: () => Record<string, z.ZodType<unknown>> } })._def;
  if (!def) return 'unknown';
  const tn = def.typeName ?? 'unknown';
  if (tn === 'ZodObject' && typeof def.shape === 'function') {
    const shape = def.shape();
    const keys = Object.keys(shape).sort();
    const parts: string[] = [];
    for (const k of keys) {
      const child = shape[k];
      if (!child) continue;
      const childDef = (child as unknown as { _def?: { typeName?: string } })._def;
      parts.push(`${k}:${childDef?.typeName ?? 'unknown'}`);
    }
    return `ZodObject{${parts.join(',')}}`;
  }
  return tn;
}
