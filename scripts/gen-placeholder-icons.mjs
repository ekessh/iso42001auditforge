// SPDX-License-Identifier: BUSL-1.1
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihd = Buffer.alloc(13);
  ihd.writeUInt32BE(size, 0);
  ihd.writeUInt32BE(size, 4);
  ihd.writeUInt8(8, 8);
  ihd.writeUInt8(6, 9);
  ihd.writeUInt8(0, 10);
  ihd.writeUInt8(0, 11);
  ihd.writeUInt8(0, 12);
  const ihdr = chunk('IHDR', ihd);

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    const off = y * stride;
    raw[off] = 0;
    for (let x = 0; x < size; x += 1) {
      const p = off + 1 + x * 4;
      raw[p] = rgba[0];
      raw[p + 1] = rgba[1];
      raw[p + 2] = rgba[2];
      raw[p + 3] = rgba[3];
    }
  }
  const idat = chunk('IDAT', deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

const root = resolve(process.cwd());
const brand = [16, 185, 129, 255];

const targets = [
  { path: 'apps/web/public/icons/icon-192.png', size: 192 },
  { path: 'apps/web/public/icons/icon-512.png', size: 512 },
  { path: 'apps/web/public/icons/icon-maskable-512.png', size: 512 },
  { path: 'apps/desktop/src-tauri/icons/32x32.png', size: 32 },
  { path: 'apps/desktop/src-tauri/icons/128x128.png', size: 128 },
  { path: 'apps/desktop/src-tauri/icons/128x128@2x.png', size: 256 },
  { path: 'apps/desktop/src-tauri/icons/icon.png', size: 512 },
];

for (const t of targets) {
  const abs = resolve(root, t.path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, makePng(t.size, brand));
  process.stdout.write(`wrote ${t.path} (${t.size}x${t.size})\n`);
}
