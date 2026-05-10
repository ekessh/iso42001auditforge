<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Secrets and Key Rotation

> Procedures for rotating the Ed25519 signing key, database password,
> and other long-lived secrets.

---

## Ed25519 Dual-Key Rotation

The signing key rotation follows a **dual-key window** to prevent gaps
in ledger verification coverage:

1. **Generate the new key** (offline, on a secure machine):
   ```bash
   # Using the AuditForge signing CLI
   pnpm signing:keygen --output new-key.json
   # Output: { "keyId": "auditforge-key-002", "privateKey": "...", "publicKey": "..." }
   ```

2. **Register the new key** as the secondary key in the platform:
   ```bash
   kubectl exec -n auditforge deploy/auditforge-api -- \
     pnpm signing:register --key-id auditforge-key-002 \
       --public-key <hex>
   ```
   The new key is stored in `signing_keys` with status `pending`.

3. **Activate the dual-key window** (operator action required):
   ```bash
   kubectl exec -n auditforge deploy/auditforge-api -- \
     pnpm signing:rotate --new-key-id auditforge-key-002 \
       --window-hours 72
   ```
   During the 72-hour window, both keys are accepted by the verifier.
   New events are signed with the new key; old events retain their
   original signature.

4. **Update the Kubernetes Secret**:
   ```bash
   kubectl create secret generic auditforge-signing-secret \
     --from-literal=ed25519PrivateKey=$(cat new-key.json | jq -r .privateKey) \
     --dry-run=client -o yaml | kubectl apply -f -
   ```
   Restart the API pod to load the new key.

5. **After 72 hours**, close the window:
   ```bash
   pnpm signing:rotate-complete --old-key-id auditforge-key-001
   ```
   The old key is marked `retired`; the verifier continues to accept
   events signed with the retired key (they are valid historical
   records).

> **Never delete a retired key.** Deleting it would break verification
> of all events it signed, invalidating the audit ledger.

---

## Database Password Rotation

1. Generate a new password (minimum 32 random characters).
2. In Postgres: `ALTER ROLE auditforge_app PASSWORD 'new_password';`
3. Update the Kubernetes Secret:
   ```bash
   kubectl patch secret auditforge-postgres-secret \
     -p '{"data":{"password":"'$(echo -n 'new_password' | base64)'"}}'
   ```
4. Restart the API and worker pods to pick up the new connection string.
5. Verify: `GET /healthz/deps` should show `postgres: ok`.

For managed Postgres (RDS, CloudSQL): use the managed rotation feature
and update the Kubernetes Secret from Secrets Manager via External
Secrets Operator.

---

## Session Secret Rotation

`SESSION_SECRET` rotation invalidates all active sessions. Schedule
during a low-traffic window:

1. Update the Kubernetes Secret.
2. Restart Next.js and API pods.
3. All auditors will need to re-authenticate with their passkeys.

---

## Meilisearch Master Key Rotation

1. Update `MEILISEARCH_MASTER_KEY` in the Kubernetes Secret.
2. Restart Meilisearch. The index is preserved.
3. Restart the API pod.

---

## TSA Provider Change

If you need to change the TSA provider (e.g. the current TSA is
shutting down):

1. Obtain an RFC 3161-compliant alternative TSA URL.
2. Update `TSA_URL` in the Kubernetes Secret / ConfigMap.
3. Restart the API pod.
4. Verify the next `report.publish` event carries a TSA token from the
   new provider.

Prior events retain their original TSA tokens from the old provider.
The verifier checks each token against the TSA certificate embedded in
the token itself, not the current `TSA_URL` config.

---

## Rotation Schedule

| Secret | Recommended rotation frequency |
|---|---|
| Ed25519 signing key | Annually, or immediately on suspected compromise |
| Database password | 90 days |
| Session secret | 6 months, or on team member departure |
| Meilisearch master key | Annually |
| MinIO access/secret key | 90 days |

---

## Related Documents

- [06-backup-and-restore.md](06-backup-and-restore.md) — backup the
  key before rotation.
- `infra/runbooks/key-rotation.md` — detailed runbook (when available).
- [../concepts/signing-and-tsa.md](../concepts/signing-and-tsa.md) —
  cryptographic walkthrough.
