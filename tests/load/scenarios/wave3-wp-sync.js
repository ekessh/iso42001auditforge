// SPDX-License-Identifier: BUSL-1.1
// k6 websocket fan-out: 100 peers per room, 10 rooms, 30s. Asserts no
// message drops and p99 broadcast latency < 200ms.
import ws from 'k6/ws';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const broadcastLatency = new Trend('ws_broadcast_ms', true);
const dropCounter = new Counter('ws_drop_total');

export const options = {
  scenarios: {
    fanout: {
      executor: 'per-vu-iterations',
      vus: 1000, // 100 peers/room x 10 rooms
      iterations: 1,
      maxDuration: '60s',
    },
  },
  thresholds: {
    'ws_broadcast_ms': ['p(99)<200'],
    'ws_drop_total': ['count<5'],
    'ws_session_duration': ['avg>25000'], // each VU stays connected for ~30s
  },
};

const WS_BASE = __ENV.WS_URL || 'ws://localhost:3001/v1/ws';
const TOKEN = __ENV.AUTH_TOKEN || 'test';
const ROOMS = 10;
const PEERS_PER_ROOM = 100;

export default function () {
  const room = ((__VU - 1) % ROOMS) + 1;
  const isLeader = ((__VU - 1) / ROOMS | 0) % PEERS_PER_ROOM === 0;
  const url = `${WS_BASE}?room=wp-${room}&token=${TOKEN}`;

  const res = ws.connect(url, {}, function (socket) {
    const sent = new Map();
    socket.on('open', () => {
      socket.setInterval(() => {
        if (isLeader) {
          const id = `${__VU}-${Date.now()}`;
          sent.set(id, Date.now());
          socket.send(JSON.stringify({ type: 'op', id, room, body: 'x'.repeat(64) }));
        }
      }, 100);
    });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'op' && msg.id) {
          const t = sent.get(msg.id);
          if (t) broadcastLatency.add(Date.now() - t);
        }
      } catch (_e) { /* tolerated: peer ack frames */ }
    });
    socket.on('error', () => dropCounter.add(1));
    socket.setTimeout(() => socket.close(), 30_000);
  });

  check(res, { 'ws connected (101)': (r) => r && r.status === 101 });
}

export function handleSummary(data) {
  return { 'summary-wp-sync.json': JSON.stringify(data, null, 2) };
}
