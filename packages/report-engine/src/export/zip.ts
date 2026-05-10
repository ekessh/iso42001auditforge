// SPDX-License-Identifier: BUSL-1.1

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
  readonly mtimeUnix?: number;
}

interface DirEntry {
  readonly name: Uint8Array;
  readonly crc: number;
  readonly size: number;
  readonly localHeaderOffset: number;
  readonly dosDate: number;
  readonly dosTime: number;
}

function dosTimeAndDate(unixSeconds: number): { time: number; date: number } {
  const d = new Date(unixSeconds * 1000);
  const date = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  const time = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >>> 1);
  return { time, date };
}

function le16(buf: Uint8Array, off: number, v: number): void {
  buf[off] = v & 0xff;
  buf[off + 1] = (v >>> 8) & 0xff;
}
function le32(buf: Uint8Array, off: number, v: number): void {
  buf[off] = v & 0xff;
  buf[off + 1] = (v >>> 8) & 0xff;
  buf[off + 2] = (v >>> 16) & 0xff;
  buf[off + 3] = (v >>> 24) & 0xff;
}

export function writeZip(entries: readonly ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const dirEntries: DirEntry[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;
    const { time, date } = dosTimeAndDate(e.mtimeUnix ?? 0);
    const local = new Uint8Array(30 + name.length);
    le32(local, 0, 0x04034b50);
    le16(local, 4, 20);
    le16(local, 6, 0);
    le16(local, 8, 0);
    le16(local, 10, time);
    le16(local, 12, date);
    le32(local, 14, crc);
    le32(local, 18, size);
    le32(local, 22, size);
    le16(local, 26, name.length);
    le16(local, 28, 0);
    local.set(name, 30);
    localChunks.push(local);
    localChunks.push(e.data);
    dirEntries.push({ name, crc, size, localHeaderOffset: offset, dosDate: date, dosTime: time });
    offset += local.length + size;
  }
  const central: Uint8Array[] = [];
  let centralSize = 0;
  for (const d of dirEntries) {
    const cd = new Uint8Array(46 + d.name.length);
    le32(cd, 0, 0x02014b50);
    le16(cd, 4, 0x031e);
    le16(cd, 6, 20);
    le16(cd, 8, 0);
    le16(cd, 10, 0);
    le16(cd, 12, d.dosTime);
    le16(cd, 14, d.dosDate);
    le32(cd, 16, d.crc);
    le32(cd, 20, d.size);
    le32(cd, 24, d.size);
    le16(cd, 28, d.name.length);
    le16(cd, 30, 0);
    le16(cd, 32, 0);
    le16(cd, 34, 0);
    le16(cd, 36, 0);
    le32(cd, 38, 0);
    le32(cd, 42, d.localHeaderOffset);
    cd.set(d.name, 46);
    central.push(cd);
    centralSize += cd.length;
  }
  const eocd = new Uint8Array(22);
  le32(eocd, 0, 0x06054b50);
  le16(eocd, 4, 0);
  le16(eocd, 6, 0);
  le16(eocd, 8, dirEntries.length);
  le16(eocd, 10, dirEntries.length);
  le32(eocd, 12, centralSize);
  le32(eocd, 16, offset);
  le16(eocd, 20, 0);
  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of localChunks) { out.set(c, p); p += c.length; }
  for (const c of central) { out.set(c, p); p += c.length; }
  out.set(eocd, p);
  return out;
}
