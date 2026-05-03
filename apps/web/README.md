# @auditforge/web

Next.js 15 (App Router) auditor workbench.

- `app/(public)/login` — passkey + OIDC sign-in
- `app/(auditor)/dashboard` — KPI overview + active engagements
- `app/(auditor)/engagements/[id]` — engagement detail with tabbed view (overview/plan/WPs/findings/probes/traces/report/audit trail)
- `app/(auditor)/clients|findings|probes|traces|library|settings` — secondary surfaces
- `app/(auditee)/portal/[engagementId]` — auditee CAPA portal (deferred)
- `app/(accreditation)/files/[fileId]` — accreditation auditor read-only portal (deferred)

CSP locked, X-Frame-Options DENY, HSTS preload, Permissions-Policy disables camera/mic/geo. Mock fixtures in `lib/mocks/` for design preview without API.

License: BUSL-1.1.
