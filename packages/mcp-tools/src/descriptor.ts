// SPDX-License-Identifier: BUSL-1.1
import type { z } from 'zod';

export interface McpToolDescriptor<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput>;
  readonly outputSchema: z.ZodType<TOutput>;
  readonly requiresConfirmation: boolean;
  readonly category: 'engagement' | 'finding' | 'coverage' | 'library' | 'working-paper' | 'report' | 'self-profile';
}

export type AnyMcpToolDescriptor = McpToolDescriptor<unknown, unknown>;

export interface SdkCompatibleTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: { readonly type: 'object'; readonly properties: Record<string, unknown>; readonly additionalProperties: false };
}

export function toSdkTool(d: AnyMcpToolDescriptor): SdkCompatibleTool {
  const def = (d.inputSchema as unknown as { _def?: { typeName?: string; shape?: () => Record<string, z.ZodType<unknown>> } })._def;
  const properties: Record<string, unknown> = {};
  if (def?.typeName === 'ZodObject' && typeof def.shape === 'function') {
    for (const [k, v] of Object.entries(def.shape())) {
      const t = (v as unknown as { _def?: { typeName?: string } })._def?.typeName ?? 'ZodString';
      properties[k] = { type: jsonType(t) };
    }
  }
  return {
    name: d.name,
    description: d.description,
    inputSchema: { type: 'object', properties, additionalProperties: false },
  };
}

function jsonType(zt: string): string {
  switch (zt) {
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodArray':
      return 'array';
    case 'ZodObject':
      return 'object';
    default:
      return 'string';
  }
}
