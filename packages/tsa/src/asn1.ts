// SPDX-License-Identifier: BUSL-1.1

export const ASN1_TAG = {
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  SEQUENCE: 0x30,
  SET: 0x31,
} as const;

export function derLength(len: number): Uint8Array {
  if (len < 0x80) return Uint8Array.of(len);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

export function derTLV(tag: number, content: Uint8Array): Uint8Array {
  const len = derLength(content.length);
  const out = new Uint8Array(1 + len.length + content.length);
  out[0] = tag;
  out.set(len, 1);
  out.set(content, 1 + len.length);
  return out;
}

export function derSequence(...children: Uint8Array[]): Uint8Array {
  const total = children.reduce((s, c) => s + c.length, 0);
  const body = new Uint8Array(total);
  let p = 0;
  for (const c of children) {
    body.set(c, p);
    p += c.length;
  }
  return derTLV(ASN1_TAG.SEQUENCE, body);
}

export function derInteger(n: number): Uint8Array {
  if (n === 0) return derTLV(ASN1_TAG.INTEGER, Uint8Array.of(0));
  const bytes: number[] = [];
  let x = n;
  while (x > 0) {
    bytes.unshift(x & 0xff);
    x = Math.floor(x / 256);
  }
  if ((bytes[0]! & 0x80) !== 0) bytes.unshift(0);
  return derTLV(ASN1_TAG.INTEGER, Uint8Array.from(bytes));
}

export function derOctetString(b: Uint8Array): Uint8Array {
  return derTLV(ASN1_TAG.OCTET_STRING, b);
}

export function derNull(): Uint8Array {
  return Uint8Array.of(ASN1_TAG.NULL, 0);
}

export function derBoolean(v: boolean): Uint8Array {
  return Uint8Array.of(0x01, 0x01, v ? 0xff : 0x00);
}

export function derOid(oid: string): Uint8Array {
  const parts = oid.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length < 2) throw new Error(`invalid OID: ${oid}`);
  const out: number[] = [40 * parts[0]! + parts[1]!];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i]!;
    const bytes: number[] = [v & 0x7f];
    v >>= 7;
    while (v > 0) {
      bytes.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    out.push(...bytes);
  }
  return derTLV(ASN1_TAG.OID, Uint8Array.from(out));
}

export interface ParsedNode {
  readonly tag: number;
  readonly length: number;
  readonly headerLen: number;
  readonly content: Uint8Array;
  readonly raw: Uint8Array;
}

export function parseNode(buf: Uint8Array, offset = 0): ParsedNode {
  if (offset >= buf.length) throw new Error('asn1: out of bounds');
  const tag = buf[offset]!;
  let p = offset + 1;
  if (p >= buf.length) throw new Error('asn1: truncated length');
  let length: number;
  const first = buf[p]!;
  p += 1;
  if ((first & 0x80) === 0) {
    length = first;
  } else {
    const n = first & 0x7f;
    if (n === 0) throw new Error('asn1: indefinite-length not supported');
    if (p + n > buf.length) throw new Error('asn1: truncated length bytes');
    length = 0;
    for (let i = 0; i < n; i++) {
      length = length * 256 + buf[p + i]!;
    }
    p += n;
  }
  const headerLen = p - offset;
  if (offset + headerLen + length > buf.length) {
    throw new Error('asn1: content extends past buffer');
  }
  const content = buf.subarray(p, p + length);
  const raw = buf.subarray(offset, p + length);
  return { tag, length, headerLen, content, raw };
}

export function* walk(buf: Uint8Array): Generator<ParsedNode> {
  let off = 0;
  while (off < buf.length) {
    const n = parseNode(buf, off);
    yield n;
    off += n.headerLen + n.length;
  }
}

export function findOctetStringContaining(buf: Uint8Array, needle: Uint8Array): Uint8Array | null {
  // Depth-first walk. Constructed types (tag with bit 0x20 set) recurse; leaves return their content.
  const stack: Uint8Array[] = [buf];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    let off = 0;
    while (off < cur.length) {
      let n: ParsedNode;
      try {
        n = parseNode(cur, off);
      } catch {
        break;
      }
      if (n.tag === ASN1_TAG.OCTET_STRING && containsBytes(n.content, needle)) {
        return n.content;
      }
      if ((n.tag & 0x20) !== 0) stack.push(n.content);
      off += n.headerLen + n.length;
    }
  }
  return null;
}

export function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}
