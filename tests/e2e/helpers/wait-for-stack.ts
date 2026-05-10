// SPDX-License-Identifier: BUSL-1.1
/**
 * Readiness probe for the local-stack: web (Next.js) + dev-mock-api.
 *
 * WHY: Each new spec file calls this in beforeAll so the test run fails fast
 * with a clear message instead of cascading flake when the stack isn't up.
 * Polls /login (web) + /healthz (api) every 500 ms until both reply or
 * `timeoutMs` elapses.
 */

export interface WaitForStackOptions {
  webUrl: string;
  apiUrl: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export async function waitForStack(opts: WaitForStackOptions): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const pollIntervalMs = opts.pollIntervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;

  const probes: Array<{ url: string; label: string; ok: boolean }> = [
    { url: `${opts.webUrl}/login`, label: 'web', ok: false },
    { url: `${opts.apiUrl}/healthz`, label: 'api', ok: false },
  ];

  while (Date.now() < deadline) {
    await Promise.all(
      probes.map(async (p) => {
        if (p.ok) return;
        try {
          const res = await fetch(p.url, { signal: AbortSignal.timeout(2_000) });
          if (res.ok || res.status === 404) p.ok = true;
        } catch {
          // not ready yet
        }
      }),
    );
    if (probes.every((p) => p.ok)) return;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  const down = probes.filter((p) => !p.ok).map((p) => `${p.label}=${p.url}`).join(', ');
  throw new Error(
    `waitForStack timed out after ${timeoutMs}ms — services not ready: ${down}`,
  );
}
