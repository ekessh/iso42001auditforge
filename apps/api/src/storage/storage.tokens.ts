// SPDX-License-Identifier: BUSL-1.1
//
// DI tokens for the storage module. Lives in a separate file so
// `storage.service.ts` can import the token without pulling in
// `storage.module.ts`, which itself imports the service — a circular
// import that breaks under Node's strict ESM resolver at runtime
// (`Cannot access 'MINIO' before initialization`).

export const MINIO = Symbol.for('AuditForge.Minio');
