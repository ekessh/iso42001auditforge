// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  SCAFFOLD_DESCRIPTORS,
  descriptorByName,
  toSdkTool,
} from '../src/index.js';

describe('mcp-tools registry', () => {
  it('exposes the five scaffold tools with unique names', () => {
    const names = SCAFFOLD_DESCRIPTORS.map((d) => d.name).sort();
    expect(names).toEqual([
      'aiSystemInventory.profile',
      'library.search',
      'report.list',
      'report.publish',
      'working-paper.read',
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('marks report.publish as requiresConfirmation and others not', () => {
    expect(descriptorByName('report.publish')?.requiresConfirmation).toBe(true);
    expect(descriptorByName('report.list')?.requiresConfirmation).toBe(false);
    expect(descriptorByName('library.search')?.requiresConfirmation).toBe(false);
    expect(descriptorByName('working-paper.read')?.requiresConfirmation).toBe(false);
    expect(descriptorByName('aiSystemInventory.profile')?.requiresConfirmation).toBe(false);
  });

  it('returns null for unknown tool names', () => {
    expect(descriptorByName('nonexistent.tool')).toBeNull();
  });

  it('toSdkTool produces JSON-Schema shaped descriptor', () => {
    const sdk = toSdkTool(descriptorByName('library.search')!);
    expect(sdk.name).toBe('library.search');
    expect(sdk.inputSchema.type).toBe('object');
    expect(sdk.inputSchema.additionalProperties).toBe(false);
    expect(sdk.inputSchema.properties.query).toEqual({ type: 'string' });
  });

  it('rejects malformed report.publish input (missing confirmationToken)', () => {
    const d = descriptorByName('report.publish')!;
    const r = d.inputSchema.safeParse({ engagementId: 'eng-1', reportId: 'rep-1' });
    expect(r.success).toBe(false);
  });

  it('accepts well-formed library.search input', () => {
    const d = descriptorByName('library.search')!;
    const r = d.inputSchema.safeParse({ query: 'data quality', clauseFilter: ['A.7.4'] });
    expect(r.success).toBe(true);
  });
});
