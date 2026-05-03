// SPDX-License-Identifier: BUSL-1.1

interface Signature {
  mime: string;
  bytes: number[];
  offset?: number;
}

const SIGNATURES: Signature[] = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'application/x-7z-compressed', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { mime: 'application/x-tar', bytes: [0x75, 0x73, 0x74, 0x61, 0x72], offset: 257 },
  { mime: 'application/gzip', bytes: [0x1f, 0x8b] },
];

export function detectMime(head: Uint8Array): string | null {
  for (const sig of SIGNATURES) {
    const off = sig.offset ?? 0;
    if (head.length < off + sig.bytes.length) continue;
    let ok = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (head[off + i] !== sig.bytes[i]) { ok = false; break; }
    }
    if (ok) return sig.mime;
  }
  return null;
}

export function isMimeSpoof(claimed: string, head: Uint8Array): boolean {
  const detected = detectMime(head);
  if (!detected) return false;
  if (claimed === detected) return false;
  if (claimed === 'application/octet-stream') return false;
  if (claimed.startsWith('application/vnd.openxmlformats') && detected === 'application/zip') return false;
  return true;
}
