// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import {
  ApiClientError,
  ApiNetworkError,
  ApiNotFoundError,
  ApiUnauthorizedError,
  ApiValidationError,
} from './errors.js';

export interface ApiFetchOptions<TBody = unknown> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: TBody;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Override base URL for this request (rare). */
  baseUrl?: string;
}

const DEFAULT_BASE_URL = 'http://localhost:4000';

export function getApiBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_ORIGIN) {
    return process.env.NEXT_PUBLIC_API_ORIGIN;
  }
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as { __NEXT_PUBLIC_API_ORIGIN__?: string };
    if (g.__NEXT_PUBLIC_API_ORIGIN__) return g.__NEXT_PUBLIC_API_ORIGIN__;
  }
  return DEFAULT_BASE_URL;
}

function buildQuery(query: ApiFetchOptions['query']): string {
  if (!query) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}/v1${p}`;
}

function mapHttpError(status: number, payload: unknown): ApiClientError {
  const detail = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
  const code = typeof detail.code === 'string' ? detail.code : 'API_ERROR';
  const message = typeof detail.message === 'string' ? detail.message : `HTTP ${status}`;
  if (status === 401) return new ApiUnauthorizedError(message);
  if (status === 404) return new ApiNotFoundError(message);
  if (status === 400 || status === 422) return new ApiValidationError(message, detail);
  return new ApiClientError(code, message, status, detail);
}

export async function apiFetchRaw<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const base = options.baseUrl ?? getApiBaseUrl();
  const url = joinUrl(base, path) + buildQuery(options.query);

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
    credentials: 'include',
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  if (options.signal) {
    init.signal = options.signal;
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    throw new ApiNetworkError('Network request failed', err);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw mapHttpError(response.status, parsed);
  }

  return parsed as T;
}

export async function apiFetch<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
  options: ApiFetchOptions = {},
): Promise<z.infer<TSchema>> {
  const raw = await apiFetchRaw<unknown>(path, options);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiValidationError('Response failed schema validation', {
      issues: result.error.issues,
      path,
    });
  }
  return result.data;
}

export const PaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    prevCursor: z.string().nullable(),
  });

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
};
