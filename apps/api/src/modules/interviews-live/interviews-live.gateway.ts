// SPDX-License-Identifier: BUSL-1.1
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Socket as NetSocket } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  StubDiarizationProvider,
  mergeWithTranscript,
  type SpeakerSegment,
} from '@auditforge/diarization';
import {
  StubTranscriptionProvider,
  type TranscriptSegment,
} from '@auditforge/transcription';
import { type Action, type Role, can } from '../../adapters/auth-core.adapter.js';
import type { InterviewsLiveService } from './interviews-live.service.js';

const PATH_PREFIX = '/sync/interview/';
const RBAC_RESOURCE = 'interview';
const RBAC_ACTION: Action = 'update';

interface SocketContext {
  readonly socketId: string;
  readonly firmId: string;
  readonly auditorId: string;
  readonly sessionId: string;
}

/**
 * WHY: Mirrors the working-papers-sync gateway pattern but speaks a JSON
 * message protocol. Clients chunk audio (or in stub mode, a string of text)
 * and the gateway pushes back labeled transcript segments + composer
 * attribution outcomes.
 */
@Injectable()
export class InterviewsLiveGateway
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(InterviewsLiveGateway.name);
  private wss: WebSocketServer | null = null;
  private readonly stubTranscription = new StubTranscriptionProvider();
  private readonly stubDiarization = new StubDiarizationProvider(2);

  constructor(
    private readonly svc: InterviewsLiveService,
    private readonly host: HttpAdapterHost,
  ) {}

  onApplicationBootstrap(): void {
    const httpAdapter = this.host.httpAdapter;
    if (!httpAdapter) {
      this.logger.warn('No HttpAdapter — interviews-live gateway disabled');
      return;
    }
    const server = httpAdapter.getHttpServer() as
      | HttpServer
      | null;
    if (!server) {
      this.logger.warn('No HTTP server — interviews-live gateway disabled');
      return;
    }
    this.wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
      if (!req.url || !req.url.startsWith(PATH_PREFIX)) return;
      const sock = socket as unknown as NetSocket;
      const sessionId = req.url
        .slice(PATH_PREFIX.length)
        .split('?')[0]
        ?.split('/')[0];
      if (!sessionId) {
        this.reject(sock, 400, 'sessionId required');
        return;
      }
      void this.authenticateAndUpgrade(req, sock, head, sessionId);
    });
    this.logger.log(`Interviews-live gateway listening on ${PATH_PREFIX}:sessionId`);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.wss) return;
    for (const c of this.wss.clients) {
      try {
        c.close(1001, 'shutdown');
      } catch (err) {
        this.logger.debug({ err }, 'close on shutdown failed');
      }
    }
    await new Promise<void>((resolve) => this.wss?.close(() => resolve()) ?? resolve());
    this.wss = null;
  }

  private reject(
    socket: NetSocket,
    code: number,
    reason: string,
  ): void {
    try {
      socket.write(`HTTP/1.1 ${code} ${reason}\r\n\r\n`);
    } catch (err) {
      this.logger.debug({ err }, 'reject write failed');
    }
    socket.destroy();
  }

  private async authenticateAndUpgrade(
    req: IncomingMessage,
    socket: NetSocket,
    head: Buffer,
    sessionId: string,
  ): Promise<void> {
    const auth = this.resolveAuth(req);
    if (!auth) return this.reject(socket, 401, 'unauthorized');
    if (!can(auth.roles, RBAC_RESOURCE, RBAC_ACTION)) {
      return this.reject(socket, 403, 'forbidden');
    }
    const decision = this.svc.authorize({
      firmId: auth.firmId,
      sessionId,
      auditorId: auth.auditorId,
    });
    if (!decision.allow) return this.reject(socket, decision.code, decision.reason);
    if (!this.wss) return this.reject(socket, 503, 'gateway not ready');
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.bindSocket(ws, {
        socketId: randomUUID(),
        firmId: auth.firmId,
        auditorId: auth.auditorId,
        sessionId,
      });
    });
  }

  private resolveAuth(
    req: IncomingMessage,
  ): { firmId: string; auditorId: string; roles: readonly Role[] } | null {
    if (process.env.NODE_ENV === 'production') return null;
    const firmId = pickHeader(req, 'x-test-firm-id');
    const auditorId = pickHeader(req, 'x-test-auditor-id');
    const rolesHeader = pickHeader(req, 'x-test-roles') ?? 'lead_auditor';
    if (!firmId || !auditorId) return null;
    const roles = rolesHeader.split(',').map((r) => r.trim()) as Role[];
    return { firmId, auditorId, roles };
  }

  private bindSocket(ws: WebSocket, ctx: SocketContext): void {
    ws.send(JSON.stringify({ kind: 'hello', sessionId: ctx.sessionId }));
    ws.on('message', (raw) => {
      void this.handleMessage(ws, ctx, raw as Buffer | string);
    });
    ws.on('close', () => {
      this.logger.debug(`socket close ${ctx.socketId}`);
    });
    ws.on('error', (err) => {
      this.logger.debug({ err }, 'socket error');
    });
  }

  private async handleMessage(
    ws: WebSocket,
    ctx: SocketContext,
    raw: Buffer | string,
  ): Promise<void> {
    const text = typeof raw === 'string' ? raw : raw.toString('utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      ws.send(JSON.stringify({ kind: 'error', code: 'BAD_JSON' }));
      return;
    }
    const body = parsed as { kind?: string; text?: string };
    if (body.kind !== 'audio-chunk' || typeof body.text !== 'string') {
      ws.send(JSON.stringify({ kind: 'error', code: 'BAD_FRAME' }));
      return;
    }
    const transcripts: TranscriptSegment[] = [];
    for await (const seg of this.stubTranscription.transcribe({
      kind: 'buffer',
      data: new Uint8Array([0]),
      mimeType: 'audio/webm',
    })) {
      transcripts.push({ ...seg, text: body.text });
      break;
    }
    const speakers: SpeakerSegment[] = [];
    for await (const sp of this.stubDiarization.diarize({
      kind: 'transcript',
      segments: transcripts.map((s) => ({ startMs: s.startMs, endMs: s.endMs })),
    })) speakers.push(sp);
    const labeled = mergeWithTranscript(transcripts, speakers);
    for (const lab of labeled) {
      const ingested = await this.svc.ingestSegment({
        firmId: ctx.firmId,
        sessionId: ctx.sessionId,
        segment: {
          id: lab.id,
          startMs: lab.startMs,
          endMs: lab.endMs,
          text: lab.text,
          confidence: lab.confidence,
          isFinal: lab.isFinal,
          words: lab.words.map((w) => ({
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs,
            confidence: w.confidence,
          })),
        },
        speakerId: lab.speakerId,
      });
      ws.send(
        JSON.stringify({
          kind: 'segment',
          segment: {
            id: lab.id,
            text: lab.text,
            speakerId: lab.speakerId,
            startMs: lab.startMs,
            endMs: lab.endMs,
            confidence: lab.confidence,
          },
          attached: ingested.attached,
          contradiction: ingested.contradiction,
        }),
      );
    }
  }
}

function pickHeader(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length === 1) return v[0];
  return undefined;
}
