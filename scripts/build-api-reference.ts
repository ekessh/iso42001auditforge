// SPDX-License-Identifier: BUSL-1.1
/**
 * Generates one Markdown file per OpenAPI tag from apps/api/openapi/generated.json.
 *
 * Usage:
 *   npx tsx scripts/build-api-reference.ts
 *
 * Output:
 *   docs/api-reference/<tag>.md  (one file per tag)
 *   docs/api-reference/README.md (alphabetic + by-tag indexes)
 *
 * To regenerate after API changes:
 *   pnpm --filter @auditforge/api gen:openapi
 *   npx tsx scripts/build-api-reference.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Types (minimal subset of OpenAPI 3.x we use)
// ---------------------------------------------------------------------------

interface OpenAPISpec {
  info: { title: string; version: string; description?: string };
  paths: Record<string, PathItem>;
  components?: { schemas?: Record<string, SchemaObject> };
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  head?: Operation;
  options?: Operation;
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
  security?: Record<string, string[]>[];
  'x-rbac'?: string[];
  'x-ledger-event'?: string;
}

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: SchemaObject;
}

interface RequestBody {
  required?: boolean;
  content?: Record<string, MediaType>;
}

interface Response {
  description?: string;
  content?: Record<string, MediaType>;
}

interface MediaType {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleObject>;
}

interface ExampleObject {
  value?: unknown;
  summary?: string;
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  $ref?: string;
  enum?: unknown[];
  description?: string;
  required?: string[];
  format?: string;
  example?: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

function slug(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function schemaToMarkdown(schema: SchemaObject | undefined, indent = 0): string {
  if (!schema) return '_none_';
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop() ?? schema.$ref;
    return `\`${name}\` (see components/schemas)`;
  }
  if (schema.type === 'object' && schema.properties) {
    const pad = '  '.repeat(indent);
    const lines: string[] = ['```json'];
    lines.push('{');
    for (const [key, val] of Object.entries(schema.properties)) {
      const req = schema.required?.includes(key) ? '' : '?';
      const typeStr = val.$ref
        ? val.$ref.split('/').pop()
        : val.type ?? 'any';
      lines.push(`  "${key}${req}": ${typeStr}  // ${val.description ?? ''}`);
    }
    lines.push('}');
    lines.push('```');
    return lines.join('\n' + pad);
  }
  if (schema.type === 'array' && schema.items) {
    return `array of ${schemaToMarkdown(schema.items, indent)}`;
  }
  const parts: string[] = [schema.type ?? 'any'];
  if (schema.format) parts.push(`(${schema.format})`);
  if (schema.enum) parts.push(`enum: ${schema.enum.map(e => `\`${e}\``).join(', ')}`);
  return parts.join(' ');
}

function parametersTable(params: Parameter[]): string {
  if (params.length === 0) return '_none_\n';
  const rows = [
    '| Name | In | Required | Type | Description |',
    '|---|---|---|---|---|',
  ];
  for (const p of params) {
    const type = schemaToMarkdown(p.schema).replace(/\n/g, ' ');
    rows.push(
      `| \`${p.name}\` | ${p.in} | ${p.required ? 'yes' : 'no'} | ${type} | ${p.description ?? ''} |`,
    );
  }
  return rows.join('\n') + '\n';
}

function renderOperation(
  method: string,
  path: string,
  op: Operation,
): string {
  const anchor = `${method.toUpperCase()}-${path.replace(/[{}\/]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
  const lines: string[] = [];

  lines.push(`### \`${method.toUpperCase()} ${path}\``);
  lines.push('');
  if (op.summary) lines.push(`**${op.summary}**`);
  if (op.description) lines.push('', op.description);
  lines.push('');

  if (op['x-rbac']?.length) {
    lines.push(`**RBAC required**: ${op['x-rbac'].map(r => `\`${r}\``).join(', ')}`);
    lines.push('');
  }

  if (op['x-ledger-event']) {
    lines.push(`**Audit ledger event emitted**: \`${op['x-ledger-event']}\``);
    lines.push('');
  }

  lines.push('**Parameters**');
  lines.push('');
  lines.push(parametersTable(op.parameters ?? []));

  if (op.requestBody) {
    lines.push('**Request body**');
    lines.push('');
    for (const [contentType, media] of Object.entries(op.requestBody.content ?? {})) {
      lines.push(`Content-Type: \`${contentType}\``);
      lines.push('');
      lines.push(schemaToMarkdown(media.schema));
      lines.push('');
      if (media.example !== undefined) {
        lines.push('Example:');
        lines.push('```json');
        lines.push(JSON.stringify(media.example, null, 2));
        lines.push('```');
        lines.push('');
      }
    }
  }

  lines.push('**Responses**');
  lines.push('');
  for (const [status, resp] of Object.entries(op.responses ?? {})) {
    lines.push(`- \`${status}\`: ${resp.description ?? ''}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const specPath = join(ROOT, 'apps/api/openapi/generated.json');
  const spec: OpenAPISpec = JSON.parse(readFileSync(specPath, 'utf-8'));

  const outDir = join(ROOT, 'docs/api-reference');
  mkdirSync(outDir, { recursive: true });

  // Group operations by tag
  const byTag = new Map<string, Array<{ method: string; path: string; op: Operation }>>();

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const op = (pathItem as Record<string, Operation | undefined>)[method];
      if (!op) continue;
      const tags = op.tags?.length ? op.tags : ['untagged'];
      for (const tag of tags) {
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag)!.push({ method, path, op });
      }
    }
  }

  const allTags = [...byTag.keys()].sort();

  // Write one file per tag
  for (const tag of allTags) {
    const ops = byTag.get(tag)!;
    const lines: string[] = [
      `<!-- SPDX-License-Identifier: BUSL-1.1 -->`,
      '',
      `# API Reference: ${tag}`,
      '',
      `> Auto-generated from \`apps/api/openapi/generated.json\`.`,
      `> Re-generate with \`npx tsx scripts/build-api-reference.ts\`.`,
      '',
      `**Related concepts**: see [../concepts/](../concepts/) for domain documentation.`,
      '',
    ];

    for (const { method, path, op } of ops) {
      lines.push(renderOperation(method, path, op));
    }

    const filename = join(outDir, `${slug(tag)}.md`);
    writeFileSync(filename, lines.join('\n'), 'utf-8');
    console.log(`Written: docs/api-reference/${slug(tag)}.md (${ops.length} endpoints)`);
  }

  // Write README with indexes
  const readmeLines: string[] = [
    `<!-- SPDX-License-Identifier: BUSL-1.1 -->`,
    '',
    `# API Reference`,
    '',
    `> Auto-generated from \`apps/api/openapi/generated.json\` by`,
    `> \`scripts/build-api-reference.ts\`.`,
    `> API version: ${spec.info.version}`,
    '',
    `## By Tag`,
    '',
  ];

  for (const tag of allTags) {
    const ops = byTag.get(tag)!;
    readmeLines.push(`- [${tag}](./${slug(tag)}.md) — ${ops.length} endpoint(s)`);
  }

  readmeLines.push('', '## Alphabetic Index (all endpoints)', '');
  const allOps: Array<{ method: string; path: string; tag: string; summary: string }> = [];
  for (const tag of allTags) {
    for (const { method, path, op } of byTag.get(tag)!) {
      allOps.push({ method, path, tag, summary: op.summary ?? '' });
    }
  }
  allOps.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  readmeLines.push('| Method | Path | Tag | Summary |');
  readmeLines.push('|---|---|---|---|');
  for (const { method, path, tag, summary } of allOps) {
    readmeLines.push(
      `| \`${method.toUpperCase()}\` | \`${path}\` | [${tag}](./${slug(tag)}.md) | ${summary} |`,
    );
  }
  readmeLines.push('');

  writeFileSync(join(outDir, 'README.md'), readmeLines.join('\n'), 'utf-8');
  console.log(`Written: docs/api-reference/README.md (${allOps.length} total endpoints)`);
}

main();
