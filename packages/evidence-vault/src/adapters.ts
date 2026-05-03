// SPDX-License-Identifier: BUSL-1.1

export interface ObjectStoreAdapter {
  presignPut(key: string, opts: { contentType: string; contentLength: number; sha256: string; ttlSeconds: number }): Promise<{ url: string; headers: Record<string, string> }>;
  presignGet(key: string, opts: { ttlSeconds: number }): Promise<string>;
  head(key: string): Promise<{ size: number; sha256?: string } | null>;
  delete(key: string): Promise<void>;
}

export interface AvScannerAdapter {
  scan(key: string): Promise<'clean' | 'infected' | 'error'>;
}

export interface OcrAdapter {
  extractText(key: string, mime: string): Promise<string | null>;
}

export interface LedgerEmitter {
  emit(eventType: string, payload: unknown): Promise<{ eventId: string }>;
}
