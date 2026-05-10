// SPDX-License-Identifier: BUSL-1.1
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';
import {
  WS_AUTH_REJECTED,
  WS_BAD_REQUEST,
  WS_FORBIDDEN,
  WS_NOT_FOUND,
} from '@auditforge/working-papers';
import { type Action, type Role, can } from '../../adapters/auth-core.adapter.js';
import { WorkingPapersSyncService } from './working-papers-sync.service.js';

interface SocketContext {
  sessionId: string;
  workingPaperId: string;
  firmId: string;
  engagementId: string;
  auditorId: string;
  awareness: Awareness;
}

const PATH_PREFIX = '/sync/working-papers/';
const RBAC_RESOURCE = 'working_paper';
const RBAC_ACTION: Action = 'update';

/**
 * WHY: Nest's @WebSocketGateway runs on Express adapters by default; we use
 * `ws` directly attached to the Fastify HTTP server's "upgrade" event so we
 * pick up the existing fastify-cookie / dev-auth pipeline for the initial
 * HTTP handshake, while still owning the binary y-websocket frame protocol.
 */
@Injectable()
export class WorkingPapersSyncGateway
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(WorkingPapersSyncGateway.name);
  private wss: WebSocketServer | null = null;

  constructor(
    private readonly service: WorkingPapersSyncService,
    private readonly host: HttpAdapterHost,
  ) {}

  onApplicationBootstrap(): void {
    const httpAdapter = this.host.httpAdapter;
    if (!httpAdapter) {
      this.logger.warn('No HttpAdapter — sync gateway disabled (test bootstrap)');
      return;
    }
    const server = httpAdapter.getHttpServer() as import('node:http').Server | null;
    if (!server) {
      this.logger.warn('No underlying HTTP server — sync gateway disabled');
      return;
    }
    this.wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
      if (!req.url || !req.url.startsWith(PATH_PREFIX)) return;
      const wpId = req.url.slice(PATH_PREFIX.length).split('?')[0]?.split('/')[0];
      const sock = socket as unknown as import('node:net').Socket;
      if (!wpId) {
        this.rejectUpgrade(sock, WS_BAD_REQUEST, 'wpId required');
        return;
      }
      void this.authenticateAndUpgrade(req, sock, head, wpId);
    });
    this.logger.log(`Working-papers sync gateway listening on ${PATH_PREFIX}:wpId`);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.wss) return;
    for (const client of this.wss.clients) {
      try {
        client.close(1001, 'shutdown');
      } catch (err) {
        this.logger.debug({ err }, 'close on shutdown failed');
      }
    }
    await new Promise<void>((resolve) =>
      this.wss?.close(() => resolve()) ?? resolve(),
    );
    this.wss = null;
  }

  private rejectUpgrade(
    socket: import('node:net').Socket,
    code: number,
    reason: string,
  ): void {
    try {
      socket.write(`HTTP/1.1 ${code} ${reason}\r\n\r\n`);
    } catch (err) {
      this.logger.debug({ err }, 'rejectUpgrade write failed');
    }
    socket.destroy();
  }

  private async authenticateAndUpgrade(
    req: IncomingMessage,
    socket: import('node:net').Socket,
    head: Buffer,
    workingPaperId: string,
  ): Promise<void> {
    const auth = this.resolveAuthFromHeaders(req);
    if (!auth) {
      this.rejectUpgrade(socket, WS_AUTH_REJECTED, 'unauthorized');
      return;
    }
    const decision = await this.service.authorize({
      firmId: auth.firmId,
      auditorId: auth.auditorId,
      workingPaperId,
      canWrite: can(auth.roles, RBAC_RESOURCE, RBAC_ACTION),
    });
    if (!decision.allow) {
      this.rejectUpgrade(socket, decision.code, decision.reason);
      return;
    }
    if (!this.wss) {
      this.rejectUpgrade(socket, 503, 'gateway not ready');
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      void this.bindSocket(ws, {
        firmId: decision.auditor.firmId,
        engagementId: decision.auditor.engagementId,
        auditorId: decision.auditor.auditorId,
        workingPaperId,
      });
    });
  }

  private resolveAuthFromHeaders(req: IncomingMessage): {
    firmId: string;
    auditorId: string;
    roles: readonly Role[];
  } | null {
    if (process.env.NODE_ENV === 'production') {
      // Production session cookie support is wired via the identity module's
      // session resolver; we simply trust the cookie plumbing applied by the
      // upstream HTTP pipeline. For now read explicit headers if and only if
      // dev-auth is disabled (placeholder until the identity adapter ships
      // its WS bridge).
      return null;
    }
    const firmId = pickHeader(req, 'x-test-firm-id');
    const auditorId = pickHeader(req, 'x-test-auditor-id');
    const rolesHeader = pickHeader(req, 'x-test-roles') ?? 'lead_auditor';
    if (!firmId || !auditorId) return null;
    const roles = rolesHeader.split(',').map((r) => r.trim()) as Role[];
    return { firmId, auditorId, roles };
  }

  private async bindSocket(
    ws: WebSocket,
    opts: {
      firmId: string;
      engagementId: string;
      auditorId: string;
      workingPaperId: string;
    },
  ): Promise<void> {
    const room = await this.service.ensureRoom({
      firmId: opts.firmId,
      engagementId: opts.engagementId,
      workingPaperId: opts.workingPaperId,
    });
    const sessionId = randomUUID();
    const awareness = new Awareness(room.state.doc);
    const ctx: SocketContext = {
      sessionId,
      workingPaperId: opts.workingPaperId,
      firmId: opts.firmId,
      engagementId: opts.engagementId,
      auditorId: opts.auditorId,
      awareness,
    };
    this.service.trackParticipant(opts.workingPaperId, sessionId);

    const sendSnapshot = (): void => {
      const snap = Y.encodeStateAsUpdateV2(room.state.doc);
      ws.send(encodeFrame('sync', snap));
    };
    sendSnapshot();
    const aw = encodeAwarenessUpdate(awareness, [...awareness.getStates().keys()]);
    ws.send(encodeFrame('awareness', aw));

    const stopBroadcast = room.state.subscribe((update, origin) => {
      if (origin === ctx.sessionId) return;
      try {
        ws.send(encodeFrame('sync', update));
      } catch (err) {
        this.logger.debug({ err }, 'broadcast send failed');
      }
    });

    const onAwarenessUpdate = (
      _changes: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ): void => {
      if (origin === ctx.sessionId) return;
      const ids = [
        ..._changes.added,
        ..._changes.updated,
        ..._changes.removed,
      ];
      try {
        ws.send(encodeFrame('awareness', encodeAwarenessUpdate(awareness, ids)));
      } catch (err) {
        this.logger.debug({ err }, 'awareness send failed');
      }
    };
    awareness.on('update', onAwarenessUpdate);

    ws.on('message', (data) => {
      void this.handleMessage(ctx, data as Buffer | ArrayBuffer);
    });
    ws.on('close', () => {
      try {
        stopBroadcast();
        awareness.off('update', onAwarenessUpdate);
        awareness.destroy();
      } catch (err) {
        this.logger.debug({ err }, 'cleanup error');
      }
      this.service.untrackParticipant(opts.workingPaperId, sessionId);
      void this.service.releaseRoomIfEmpty(opts.workingPaperId).catch((err) => {
        this.logger.error({ err }, 'failed to release room');
      });
    });
    ws.on('error', (err) => {
      this.logger.debug({ err }, 'socket error');
    });
  }

  private async handleMessage(
    ctx: SocketContext,
    raw: Buffer | ArrayBuffer,
  ): Promise<void> {
    const buf = raw instanceof ArrayBuffer ? Buffer.from(new Uint8Array(raw)) : Buffer.from(raw);
    const frame = decodeFrame(buf);
    if (!frame) return;
    if (frame.kind === 'sync') {
      try {
        await this.service.ingestUpdate({
          workingPaperId: ctx.workingPaperId,
          update: new Uint8Array(frame.payload),
          auditorId: ctx.auditorId,
        });
      } catch (err) {
        this.logger.error({ err }, 'ingestUpdate failed');
      }
      return;
    }
    if (frame.kind === 'awareness') {
      try {
        applyAwarenessUpdate(ctx.awareness, new Uint8Array(frame.payload), ctx.sessionId);
      } catch (err) {
        this.logger.debug({ err }, 'awareness apply failed');
      }
      return;
    }
  }
}

function pickHeader(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length === 1) return v[0];
  return undefined;
}

/* ------------------------------------------------------------------------- */
/* Wire format                                                                */
/* ------------------------------------------------------------------------- */
// Binary envelope: [1 byte kind][N bytes payload]. 0x01 = sync, 0x02 = awareness.

const KIND_SYNC = 0x01;
const KIND_AWARENESS = 0x02;
const _UNUSED_FORBIDDEN = WS_FORBIDDEN;
const _UNUSED_NOT_FOUND = WS_NOT_FOUND;

export function encodeFrame(kind: 'sync' | 'awareness', payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(payload.byteLength + 1);
  out[0] = kind === 'sync' ? KIND_SYNC : KIND_AWARENESS;
  out.set(payload, 1);
  return out;
}

export function decodeFrame(buf: Buffer): { kind: 'sync' | 'awareness'; payload: Uint8Array } | null {
  if (buf.byteLength < 2) return null;
  const k = buf[0];
  const payload = new Uint8Array(buf.subarray(1));
  if (k === KIND_SYNC) return { kind: 'sync', payload };
  if (k === KIND_AWARENESS) return { kind: 'awareness', payload };
  return null;
}

void _UNUSED_FORBIDDEN;
void _UNUSED_NOT_FOUND;
