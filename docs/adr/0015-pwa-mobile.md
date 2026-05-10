# ADR-0015: PWA via next-pwa instead of separate apps/mobile

- **Status**: Accepted
- **Date**: 2026-05-10
- **Deciders**: AuditForge core
- **Phase**: 14
- **Tags**: mobile, pwa, distribution

## Context

The Wave 2 inventory called for `apps/mobile` to be scaffolded. The straightforward interpretation — a separate Next.js app for mobile-only routes — would duplicate the auth flow, the engagement workspace, the working-paper editor, and the evidence vault. Auditors using mobile primarily want field access to the same audit they were running on desktop minutes ago, not a different product.

## Decision

**Mobile is the PWA build of `@auditforge/web`.** No second Next.js app.

Concretely: `apps/web` ships a `manifest.webmanifest` (icons, theme/background colour, `display: standalone`, `orientation: portrait`) and a service worker registered via `next-pwa`. Runtime caching is `NetworkFirst` for `/v1/*` (fresh data preferred, 5-second timeout, cache fallback) and `CacheFirst` for `/_next/static/**` (immutable bundles). An `/offline` page provides a graceful-degradation UI for cache misses. `apps/mobile/` is a registry stub — `package.json` + `README.md` — pointing back to `@auditforge/web` so the workspace inventory remains coherent.

## Consequences

### Positive

- **Zero distribution friction**: No app store review, no signing certificates, no per-OS native builds. "Install" is a browser menu item.
- **100% code reuse**: A single source of truth for routes, components, auth, and Yjs CRDT working-paper sync. Touch-target (44×44 px) and viewport rules enforced at the component level work everywhere.
- **Aligned offline model**: The existing offline-first working-papers package uses Yjs IndexedDB persistence — the PWA service worker complements this cleanly.
- **Faster iteration**: Mobile bug fix = web deploy. No version skew, no app-store rollout delay.

### Negative

- **iOS PWA limits**: No background sync, no push notifications without web-push subscription, limited storage quotas. Mitigated by Yjs CRDT persistence + manual sync on foreground.
- **No camera or sensor APIs beyond `getUserMedia`**: If we eventually need raw camera frames or barcode hardware, we'll need a Capacitor or Tauri-Mobile shell.
- **App-store discoverability**: Auditors find AuditForge via the firm's onboarding, not stores — acceptable for a B2B auditor tool.

### Neutral

- The `apps/mobile/` directory exists only to keep the workspace inventory legible; future native shell work would replace its content without a workspace rename.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Separate Next.js app under `apps/mobile` | Code duplication, auth/state divergence risk, doubles deploy targets for no user benefit. |
| React Native | Auditors don't need native APIs the web can't reach today; rebuilding the workspace twice is unjustified. |
| Capacitor wrapping the web app | Adds native build pipeline + store overhead for an audience that installs via internal links. Reserved for future if iOS blocks a needed capability. |
| Skip mobile entirely | Field auditors need engagement read access from a phone; not optional. |

## Compliance Implications

- ISO 42001 A.5.4 (governance of AI system access) — PWA install prompts are user-driven; consent boundaries match the web app.
- WCAG 2.2 AA — touch targets, focus order, and viewport zoom rules apply equally to PWA and desktop browser.
- The service worker scope is `/`. CSP enforcement remains the web app's `next.config.ts` headers + middleware nonce; service worker registration is same-origin only.

## Follow-Ups

- [ ] Phase 14: Validate iOS Safari and Android Chrome install flows with two field auditors.
- [ ] Phase 14: Add NavigationFallback rule to the SW so navigation cache misses return `/offline` automatically.
- [ ] Phase 15: Review iOS Web Push availability and decide whether a Capacitor shell is still unnecessary.
