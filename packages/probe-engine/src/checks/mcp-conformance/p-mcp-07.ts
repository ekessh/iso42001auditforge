// SPDX-License-Identifier: BUSL-1.1
import type { AnyProbeDefinition } from '../../dsl.js';

import {
  MCP_CONFORMANCE_CATALOGUE,
  defineMcpConformanceProbe,
  type McpConformanceAdapterOptions,
} from './shared.js';

const ENTRY = MCP_CONFORMANCE_CATALOGUE.find((e) => e.sidecarCheckId === 'P-MCP-07')!;

export function buildPMcp07(options: McpConformanceAdapterOptions): AnyProbeDefinition {
  return defineMcpConformanceProbe(ENTRY, options);
}

export const P_MCP_07_META = ENTRY;
