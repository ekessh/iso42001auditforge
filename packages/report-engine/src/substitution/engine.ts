// SPDX-License-Identifier: BUSL-1.1
import { TemplateRenderError } from '../errors.js';
import { defaultHelpers, type Helper } from './helpers.js';

/**
 * Strict Mustache-like substitution engine. Supports:
 *
 * - `{{var}}` — resolves a dotted path against the variables; throws on
 *   undefined unless the variable is wrapped in `{{?optional}}`.
 * - `{{#each items}}...{{/each}}` — nested loops; inside the loop, `{{this}}`
 *   refers to the current item, and dotted paths resolve against the item.
 * - `{{#if path}}...{{/if}}` and `{{#unless path}}...{{/unless}}`.
 * - `{{helper arg arg "literal"}}` — single-line helper invocation.
 * - HTML escaping via `{{{var}}}` (raw) vs `{{var}}` (escape) — the renderer
 *   decides what `escape` means; we expose it on the context.
 *
 * Errors include a 1-indexed line number relative to the input string and
 * the dotted path that triggered the failure.
 */

export interface SubstitutionOptions {
  readonly variables: Readonly<Record<string, unknown>>;
  readonly helpers?: Readonly<Record<string, Helper>>;
  readonly locale?: string;
  /**
   * Strict mode: undefined `{{var}}` lookups throw `TemplateRenderError`
   * unless the variable is wrapped in `{{?...}}`. Default: true.
   */
  readonly strict?: boolean;
  /** Minimal HTML-escape used by `{{var}}`. */
  readonly escape?: (s: string) => string;
}

const DEFAULT_ESCAPE = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

interface Frame {
  readonly scope: Record<string, unknown>;
  readonly path: string;
}

const TOKEN_RE =
  /\{\{\{\s*([^{}]+?)\s*\}\}\}|\{\{\s*(#each|#if|#unless|\/each|\/if|\/unless|\?|!|else)?\s*([^{}]*?)\s*\}\}/g;

interface Token {
  readonly type:
    | 'text'
    | 'var'
    | 'rawvar'
    | 'optvar'
    | 'each'
    | 'endeach'
    | 'if'
    | 'unless'
    | 'else'
    | 'endif'
    | 'endunless'
    | 'comment';
  readonly raw: string;
  readonly expr: string;
  readonly line: number;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  const lineAt = (offset: number): number => {
    let line = 1;
    for (let i = 0; i < offset && i < src.length; i++) {
      if (src.charCodeAt(i) === 10) line++;
    }
    return line;
  };
  while ((match = TOKEN_RE.exec(src)) !== null) {
    if (match.index > lastIndex) {
      const text = src.slice(lastIndex, match.index);
      tokens.push({ type: 'text', raw: text, expr: text, line: lineAt(lastIndex) });
    }
    const tripleExpr = match[1];
    const tag = match[2];
    const expr = match[3] ?? '';
    const line = lineAt(match.index);
    if (tripleExpr !== undefined) {
      tokens.push({ type: 'rawvar', raw: match[0], expr: tripleExpr, line });
    } else if (tag === '#each') {
      tokens.push({ type: 'each', raw: match[0], expr, line });
    } else if (tag === '/each') {
      tokens.push({ type: 'endeach', raw: match[0], expr, line });
    } else if (tag === '#if') {
      tokens.push({ type: 'if', raw: match[0], expr, line });
    } else if (tag === '/if') {
      tokens.push({ type: 'endif', raw: match[0], expr, line });
    } else if (tag === '#unless') {
      tokens.push({ type: 'unless', raw: match[0], expr, line });
    } else if (tag === '/unless') {
      tokens.push({ type: 'endunless', raw: match[0], expr, line });
    } else if (tag === 'else') {
      tokens.push({ type: 'else', raw: match[0], expr, line });
    } else if (tag === '?') {
      tokens.push({ type: 'optvar', raw: match[0], expr, line });
    } else if (tag === '!') {
      tokens.push({ type: 'comment', raw: match[0], expr, line });
    } else {
      tokens.push({ type: 'var', raw: match[0], expr, line });
    }
    lastIndex = TOKEN_RE.lastIndex;
  }
  if (lastIndex < src.length) {
    const text = src.slice(lastIndex);
    tokens.push({ type: 'text', raw: text, expr: text, line: lineAt(lastIndex) });
  }
  return tokens;
}

function lookup(
  path: string,
  stack: readonly Frame[],
): { found: boolean; value: unknown; resolvedPath: string } {
  if (path === 'this' || path === '.') {
    const top = stack[stack.length - 1];
    return {
      found: top !== undefined,
      value: top?.scope,
      resolvedPath: top?.path ?? '',
    };
  }
  const parts = path.split('.');
  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i];
    if (frame === undefined) continue;
    const root = frame.scope;
    if (root === undefined || root === null) continue;
    if (typeof root !== 'object') continue;
    let cur: unknown = root;
    let ok = true;
    for (const p of parts) {
      if (cur !== null && typeof cur === 'object' && p in (cur as object)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        ok = false;
        break;
      }
    }
    if (ok) {
      const trail = frame.path.length > 0 ? `${frame.path}.${path}` : path;
      return { found: true, value: cur, resolvedPath: trail };
    }
  }
  return { found: false, value: undefined, resolvedPath: path };
}

function isTruthy(v: unknown): boolean {
  if (v === undefined || v === null || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

function parseHelperCall(expr: string): { name: string; args: string[] } | null {
  // helper invocation if the expression has whitespace and starts with a
  // bareword that is not a dotted path.
  const trimmed = expr.trim();
  if (!/\s/.test(trimmed)) return null;
  const tokens: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i + 1;
      i = start;
      while (i < trimmed.length && trimmed[i] !== quote) i++;
      tokens.push(trimmed.slice(start, i));
      i++;
    } else {
      const start = i;
      while (
        i < trimmed.length &&
        trimmed[i] !== ' ' &&
        trimmed[i] !== '\t'
      ) {
        i++;
      }
      tokens.push(trimmed.slice(start, i));
    }
  }
  if (tokens.length < 2) return null;
  const [name, ...args] = tokens;
  if (name === undefined) return null;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return null;
  return { name, args };
}

function evalExpr(
  expr: string,
  stack: readonly Frame[],
  helpers: Readonly<Record<string, Helper>>,
  line: number,
): { found: boolean; value: unknown; path: string } {
  const helperCall = parseHelperCall(expr);
  if (helperCall !== null) {
    const helper = helpers[helperCall.name];
    if (helper === undefined) {
      throw new TemplateRenderError(
        `unknown helper '${helperCall.name}'`,
        helperCall.name,
        line,
      );
    }
    const resolvedArgs = helperCall.args.map((a) => {
      // strings if originally quoted (already stripped) -> heuristic: parse as
      // path first, fall back to literal.
      const r = lookup(a, stack);
      return r.found ? r.value : a;
    });
    return { found: true, value: helper(...resolvedArgs), path: expr };
  }
  const r = lookup(expr, stack);
  return { found: r.found, value: r.value, path: r.resolvedPath };
}

interface CompiledRender {
  output: string;
}

function renderTokens(
  tokens: readonly Token[],
  start: number,
  end: number,
  stack: Frame[],
  helpers: Readonly<Record<string, Helper>>,
  strict: boolean,
  escape: (s: string) => string,
): CompiledRender {
  let out = '';
  let i = start;
  while (i < end) {
    const tok = tokens[i];
    if (tok === undefined) break;
    switch (tok.type) {
      case 'text':
        out += tok.raw;
        i++;
        break;
      case 'comment':
        i++;
        break;
      case 'var': {
        const v = evalExpr(tok.expr, stack, helpers, tok.line);
        if (!v.found) {
          if (strict) {
            throw new TemplateRenderError(
              `undefined variable '${tok.expr}'`,
              v.path,
              tok.line,
            );
          }
          i++;
          break;
        }
        out += escape(stringify(v.value));
        i++;
        break;
      }
      case 'rawvar': {
        const v = evalExpr(tok.expr, stack, helpers, tok.line);
        if (!v.found) {
          if (strict) {
            throw new TemplateRenderError(
              `undefined variable '${tok.expr}'`,
              v.path,
              tok.line,
            );
          }
          i++;
          break;
        }
        out += stringify(v.value);
        i++;
        break;
      }
      case 'optvar': {
        const v = evalExpr(tok.expr, stack, helpers, tok.line);
        out += v.found ? escape(stringify(v.value)) : '';
        i++;
        break;
      }
      case 'each': {
        const close = findClose(tokens, i, end, 'each');
        const elseIdx = findElse(tokens, i + 1, close);
        const v = evalExpr(tok.expr, stack, helpers, tok.line);
        const items = Array.isArray(v.value) ? v.value : [];
        if (!v.found && strict) {
          throw new TemplateRenderError(
            `undefined loop target '${tok.expr}'`,
            v.path,
            tok.line,
          );
        }
        if (items.length === 0 && elseIdx !== -1) {
          out += renderTokens(
            tokens,
            elseIdx + 1,
            close,
            stack,
            helpers,
            strict,
            escape,
          ).output;
        } else {
          const bodyEnd = elseIdx === -1 ? close : elseIdx;
          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            const scope: Record<string, unknown> =
              item !== null && typeof item === 'object'
                ? { ...(item as Record<string, unknown>), '@index': idx, '@first': idx === 0, '@last': idx === items.length - 1 }
                : { this: item, '@index': idx, '@first': idx === 0, '@last': idx === items.length - 1 };
            stack.push({ scope, path: `${v.path}[${idx}]` });
            out += renderTokens(
              tokens,
              i + 1,
              bodyEnd,
              stack,
              helpers,
              strict,
              escape,
            ).output;
            stack.pop();
          }
        }
        i = close + 1;
        break;
      }
      case 'if':
      case 'unless': {
        const closeType = tok.type === 'if' ? 'if' : 'unless';
        const close = findClose(tokens, i, end, closeType);
        const elseIdx = findElse(tokens, i + 1, close);
        const v = evalExpr(tok.expr, stack, helpers, tok.line);
        const cond = tok.type === 'if' ? isTruthy(v.value) : !isTruthy(v.value);
        const bodyEnd = elseIdx === -1 ? close : elseIdx;
        if (cond) {
          out += renderTokens(
            tokens,
            i + 1,
            bodyEnd,
            stack,
            helpers,
            strict,
            escape,
          ).output;
        } else if (elseIdx !== -1) {
          out += renderTokens(
            tokens,
            elseIdx + 1,
            close,
            stack,
            helpers,
            strict,
            escape,
          ).output;
        }
        i = close + 1;
        break;
      }
      case 'endeach':
      case 'endif':
      case 'endunless':
      case 'else':
        // hit a closing tag at this level — bubble up
        return { output: out };
      default:
        i++;
    }
  }
  return { output: out };
}

function findClose(
  tokens: readonly Token[],
  open: number,
  end: number,
  kind: 'each' | 'if' | 'unless',
): number {
  let depth = 0;
  const openType = kind;
  const closeType =
    kind === 'each' ? 'endeach' : kind === 'if' ? 'endif' : 'endunless';
  for (let j = open + 1; j < end; j++) {
    const t = tokens[j];
    if (t === undefined) continue;
    if (t.type === openType) depth++;
    else if (t.type === closeType) {
      if (depth === 0) return j;
      depth--;
    }
  }
  const opener = tokens[open];
  throw new TemplateRenderError(
    `unbalanced block: missing {{/${kind}}}`,
    opener?.expr ?? '',
    opener?.line ?? 0,
  );
}

function findElse(
  tokens: readonly Token[],
  start: number,
  close: number,
): number {
  let depth = 0;
  for (let j = start; j < close; j++) {
    const t = tokens[j];
    if (t === undefined) continue;
    if (t.type === 'each' || t.type === 'if' || t.type === 'unless') depth++;
    else if (t.type === 'endeach' || t.type === 'endif' || t.type === 'endunless') depth--;
    else if (t.type === 'else' && depth === 0) return j;
  }
  return -1;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(v);
}

/**
 * Render a template string with strict variable substitution.
 *
 * @throws TemplateRenderError if `strict` and a variable is undefined or a
 * helper is unknown.
 */
export function render(source: string, opts: SubstitutionOptions): string {
  const helpers = { ...defaultHelpers, ...(opts.helpers ?? {}) };
  const escape = opts.escape ?? DEFAULT_ESCAPE;
  const strict = opts.strict ?? true;
  const tokens = tokenize(source);
  const stack: Frame[] = [{ scope: { ...opts.variables }, path: '' }];
  return renderTokens(tokens, 0, tokens.length, stack, helpers, strict, escape).output;
}
