// SPDX-License-Identifier: BUSL-1.1

export interface KeyDescriptor {
  readonly keyId: string;
  readonly publicKeyBase64: string;
  readonly algorithm: 'Ed25519';
  readonly hardwareBacked: boolean;
}

export interface SigningProvider {
  describe(): Promise<KeyDescriptor>;
  sign(message: Uint8Array): Promise<Uint8Array>;
  verify(message: Uint8Array, signature: Uint8Array, publicKeyBase64?: string): Promise<boolean>;
}
