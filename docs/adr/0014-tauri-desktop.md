# ADR-0014: Tauri 2 chosen over Electron for desktop wrapper

- **Status**: Accepted
- **Date**: 2026-05-10
- **Deciders**: AuditForge core
- **Phase**: 14
- **Tags**: desktop, packaging, security

## Context

AuditForge's primary form factor is `apps/web` (Next.js 15). Auditors working in the field need a desktop client that loads the same UI, with native FS access scoped to a configured "audit vault", native dialogs for evidence import/export, and an OS menu. The wrapper choice affects bundle size, attack surface, and the security review burden during certification readiness.

## Decision

Wrap `@auditforge/web` in **Tauri 2**, not Electron.

The desktop app is `apps/desktop`, with `src-tauri/` (Rust + Tauri 2 SDK) bundling a release Next.js build (`frontendDist: ../../web/.next`) and exposing scoped capabilities (`fs`, `dialog`, `shell.open` to https URLs only). No Node sidecar, no arbitrary-FS allowlist, no `nodeIntegration`. The native menu and updater are stubs in the scaffold; concrete handlers wire in Phase 14 finalisation.

## Consequences

### Positive

- **Bundle size**: Tauri uses the OS WebView (WebView2/WKWebView/webkitgtk). Installer ~10–15 MB vs. Electron ~120+ MB.
- **Security model**: Capability-based permissions in `capabilities/default.json` make the threat surface explicit. Easier to defend during ISO 27001 / 42001 certification of AuditForge itself.
- **No Node in renderer**: The webview never gets `process`, `require`, or fs. Compromised JS cannot escalate.
- **Rust backend**: Native code is memory-safe by default; updater signing is built in.

### Negative

- **Rust toolchain prerequisite**: Contributors need `rustup` installed locally for `tauri dev`/`build`. Mitigated by clear README instructions and CI dockerised builds.
- **Smaller ecosystem**: Fewer pre-built plugins than Electron. We use only first-party Tauri plugins (`fs`, `dialog`, `shell`, `updater`); third-party plugins reviewed case-by-case.
- **WebView differences across OSes**: WebKit on macOS lags Chromium. We test the auditor workflow in all three.

### Neutral

- Tauri 2 introduced new permissions/capabilities model — incompatible with v1. We start fresh on v2 directly.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Electron | 10x bundle size, larger attack surface, Node-in-renderer footgun, harder to harden for certification. |
| Wails (Go) | Smaller community, less mature on Linux, no first-party updater. |
| Pure web only | Auditors need offline file vault and native dialog flows; PWA is insufficient. |
| Capacitor desktop | Capacitor is mobile-first; desktop story is immature. |

## Compliance Implications

- ISO 42001 A.6.2.2 (deployment controls) — capability allowlist is auditable evidence of least privilege.
- ISO 27001 A.8.25/A.8.27 — secure development; Tauri's signed-updater model satisfies update-channel integrity.
- The desktop app inherits the web app's CSP. We mirror the policy in `tauri.conf.json` `app.security.csp`.

## Follow-Ups

- [ ] Phase 14: real updater endpoint + Ed25519 signing key in CI secret store.
- [ ] Phase 14: native menu actions wired to the Next.js app via Tauri events.
- [ ] Phase 14: signed installers for Win/macOS/Linux.
- [ ] Phase 15: Tauri Mobile evaluation if PWA hits iOS limits.
