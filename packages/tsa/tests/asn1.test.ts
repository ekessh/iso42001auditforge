// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  derInteger,
  derOctetString,
  derOid,
  derSequence,
  parseNode,
  walk,
} from '../src/asn1.js';

describe('ASN.1 DER primitives', () => {
  it('encodes a small INTEGER', () => {
    expect(Array.from(derInteger(5))).toEqual([0x02, 0x01, 0x05]);
  });

  it('encodes a high-bit INTEGER with leading zero', () => {
    expect(Array.from(derInteger(128))).toEqual([0x02, 0x02, 0x00, 0x80]);
  });

  it('encodes an OID with multi-byte sub-arc', () => {
    // 2.16.840.1.101.3.4.2.1 (sha-256)
    const bytes = Array.from(derOid('2.16.840.1.101.3.4.2.1'));
    expect(bytes[0]).toBe(0x06);
    expect(bytes[1]).toBe(bytes.length - 2);
  });

  it('encodes an OCTET STRING and parses it back', () => {
    const blob = derOctetString(Uint8Array.of(1, 2, 3));
    const node = parseNode(blob);
    expect(node.tag).toBe(0x04);
    expect(Array.from(node.content)).toEqual([1, 2, 3]);
  });

  it('walks SEQUENCE children in order', () => {
    const seq = derSequence(derInteger(1), derInteger(2), derInteger(3));
    const node = parseNode(seq);
    const childInts: number[] = [];
    for (const c of walk(node.content)) {
      expect(c.tag).toBe(0x02);
      childInts.push(c.content[c.content.length - 1] ?? -1);
    }
    expect(childInts).toEqual([1, 2, 3]);
  });

  it('encodes long-form length when content > 127 bytes', () => {
    const big = new Uint8Array(200);
    const seq = derSequence(derOctetString(big));
    const node = parseNode(seq);
    expect(node.tag).toBe(0x30);
    expect(node.content.length).toBeGreaterThan(200);
  });
});
