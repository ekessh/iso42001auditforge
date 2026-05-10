<!-- SPDX-License-Identifier: BUSL-1.1 -->
# @auditforge/mobile

**Mobile is the PWA build of `@auditforge/web`.** There is no separate Next.js app here — that would duplicate routes, components, and the auth flow for no benefit.

## Install on a phone

1. Open the AuditForge web app in a mobile browser (Safari iOS, Chrome/Edge Android).
2. Browser menu → **Add to Home Screen** (or **Install app**).
3. The app installs as a PWA: standalone window, custom icon, offline cache.

The install prompt is gated by `next-pwa`'s service-worker registration and the `manifest.webmanifest` shipped with `apps/web`.

## Why a PWA, not a separate app?

See [`docs/adr/0015-pwa-mobile.md`](../../docs/adr/0015-pwa-mobile.md). Short version: zero distribution friction (no app stores), 100% code reuse with `@auditforge/web`, controlled offline behaviour aligned with the existing Yjs CRDT working-paper sync.

## Capabilities

- Service worker (registered automatically by `next-pwa`).
- Offline page at `/offline` for cache misses.
- `manifest.webmanifest` with name, icons (192/512), theme/background colour, `display: standalone`, `orientation: portrait`.
- Runtime caching:
  - `NetworkFirst` for `/v1/*` API calls (fresh data preferred, cache fallback).
  - `CacheFirst` for `/_next/static/**` (immutable bundles).

## Touch targets

All interactive controls in mobile-facing routes meet WCAG 2.2 AA (44×44 px minimum). New components added under `apps/web/components/mobile/**` MUST preserve this.

## Native shell?

If a future engagement needs camera, push, or background sync beyond what PWAs allow on iOS, the path is:

1. Wrap `@auditforge/web` in a Capacitor or Tauri Mobile shell.
2. Re-use the existing manifest + service worker.
3. Keep `apps/mobile` as the registry entry; only the build script changes.

That decision lives outside this scaffold.
