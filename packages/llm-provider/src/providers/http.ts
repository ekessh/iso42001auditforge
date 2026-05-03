// SPDX-License-Identifier: BUSL-1.1

export type HttpFetch = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{ status: number; text: () => Promise<string>; json: () => Promise<unknown> }>;

export const defaultFetch: HttpFetch = async (url, init) => {
  const requestInit: RequestInit = {
    method: init?.method ?? 'POST',
    headers: init?.headers ?? { 'Content-Type': 'application/json' },
  };
  if (init?.body !== undefined) requestInit.body = init.body;
  const res = await fetch(url, requestInit);
  return {
    status: res.status,
    text: () => res.text(),
    json: () => res.json() as Promise<unknown>,
  };
};
