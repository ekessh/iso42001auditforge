// SPDX-License-Identifier: BUSL-1.1
import type { AnyProbeDefinition } from '../../dsl.js';

import { buildPMcp01 } from './p-mcp-01.js';
import { buildPMcp02 } from './p-mcp-02.js';
import { buildPMcp03 } from './p-mcp-03.js';
import { buildPMcp04 } from './p-mcp-04.js';
import { buildPMcp05 } from './p-mcp-05.js';
import { buildPMcp06 } from './p-mcp-06.js';
import { buildPMcp07 } from './p-mcp-07.js';
import { buildPMcp08 } from './p-mcp-08.js';
import {
  MCP_CONFORMANCE_CATALOGUE,
  type McpConformanceAdapterOptions,
} from './shared.js';

export {
  MCP_CONFORMANCE_CATALOGUE,
  type McpConformanceAdapterOptions,
  type McpConformanceEntry,
  type McpConformanceParams,
} from './shared.js';

export {
  buildPMcp01,
  buildPMcp02,
  buildPMcp03,
  buildPMcp04,
  buildPMcp05,
  buildPMcp06,
  buildPMcp07,
  buildPMcp08,
};

export {
  P_MCP_01_META,
} from './p-mcp-01.js';
export { P_MCP_02_META } from './p-mcp-02.js';
export { P_MCP_03_META } from './p-mcp-03.js';
export { P_MCP_04_META } from './p-mcp-04.js';
export { P_MCP_05_META } from './p-mcp-05.js';
export { P_MCP_06_META } from './p-mcp-06.js';
export { P_MCP_07_META } from './p-mcp-07.js';
export { P_MCP_08_META } from './p-mcp-08.js';

export function buildMcpConformancePack(
  options: McpConformanceAdapterOptions,
): readonly AnyProbeDefinition[] {
  return [
    buildPMcp01(options),
    buildPMcp02(options),
    buildPMcp03(options),
    buildPMcp04(options),
    buildPMcp05(options),
    buildPMcp06(options),
    buildPMcp07(options),
    buildPMcp08(options),
  ];
}
