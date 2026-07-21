/**
 * Minimal typings for the tweetnacl surface used by core/sync (the registry
 * has no @types/tweetnacl package — 404 as of 2026-07-21).
 */
declare module 'tweetnacl' {
  export function randomBytes(n: number): Uint8Array;
  export function secretbox(message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  export namespace secretbox {
    function open(box: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
    const keyLength: number;
    const nonceLength: number;
  }
}
