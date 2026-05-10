<!-- SPDX-License-Identifier: BUSL-1.1 -->
# @auditforge/desktop

Tauri 2 wrapper around `@auditforge/web`. Auditor-only workbench (BUSL-1.1).

## Why Tauri 2 instead of Electron?

See [`docs/adr/0014-tauri-desktop.md`](../../docs/adr/0014-tauri-desktop.md). Short version: bundle size, Rust security model, native APIs without Node sidecar.

## Prerequisites

| OS | Requirements |
|----|--------------|
| All | Rust toolchain (`rustup install stable`), Node 20+, pnpm 9+ |
| Windows | Microsoft C++ Build Tools, WebView2 (preinstalled on Win 11) |
| macOS | Xcode Command Line Tools (`xcode-select --install`) |
| Linux | `webkit2gtk-4.1`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, build-essential |

Per [tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/).

## Develop

```sh
pnpm --filter @auditforge/desktop dev
```

This invokes `tauri dev`, which:
1. Runs `pnpm --filter @auditforge/web dev` (`beforeDevCommand`).
2. Waits for `http://localhost:3000` and opens it in a Tauri window (`devUrl`).
3. Hot-reloads on web app + Rust source changes.

## Build

```sh
pnpm --filter @auditforge/desktop build
```

This invokes `tauri build`, which:
1. Runs `pnpm --filter @auditforge/web build` (`beforeBuildCommand`).
2. Bundles the Next.js production output (`frontendDist: ../../web/.next`).
3. Produces platform installers in `apps/desktop/src-tauri/target/release/bundle/`.

## Permissions (Tauri 2 capabilities)

`src-tauri/capabilities/default.json` declares the minimum capability set:

- `core:default` + window control (set title, minimize, maximize, close)
- `dialog:*` — open/save dialogs for evidence selection and report export
- `fs:read-*` / `fs:write-*` — scoped to `$APPDATA/AuditForge/vault/**`, `$DOCUMENT/AuditForge/**`, and `$DOWNLOAD/AuditForge-Export/**` only (see `tauri.conf.json` `plugins.fs.scope`)
- `shell:allow-open` — restricted to `^https?://` (evidence URLs)
- `updater:default` — auto-updater stub (endpoint is a placeholder; Phase 14 wires real signing)

NO arbitrary fs access. NO arbitrary shell. NO clipboard write without user gesture (handled by web app).

## Native menu

File / Edit / View / Audit / Help — `src-tauri/src/main.rs`. Menu events forward to the web app via Tauri events; concrete handlers wired in Phase 14.

## CSP

`tauri.conf.json` `app.security.csp` mirrors the web app's CSP modulo nonces (Tauri serves a static webview; nonces are not applicable). Allows `'self'` origins, the dev API port (4000), and the Next.js dev WS for HMR.

## Status

Phase 14 scaffold. The window opens, loads the web app, and inherits the existing Auth.js + WebAuthn flow. Native menu items are stubs.
