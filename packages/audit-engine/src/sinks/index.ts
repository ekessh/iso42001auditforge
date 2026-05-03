// SPDX-License-Identifier: BUSL-1.1
//
// Durable sink barrel. Re-exports the Postgres-backed `EventRepository`
// and the transactional handle types used by the API's audit-trail
// interceptor (BLK-3 fix).

export * from './postgres-sink.js';
