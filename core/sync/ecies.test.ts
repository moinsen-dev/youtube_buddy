import { generateEphemeralKeyPair, openSealedMasterKey, sealMasterKey } from './ecies';
import { generateMasterKey } from './crypto';

/**
 * Round-trip: a master key sealed for the TV's ephemeral public key must be
 * openable only with the matching secret key (TV pairing v2, phase 12).
 */
describe('ecies (TV pairing)', () => {
  it('seal → open returns the same master key', () => {
    const masterKey = generateMasterKey();
    const tv = generateEphemeralKeyPair();

    const sealed = sealMasterKey(masterKey, tv.publicKeyB64);
    const opened = openSealedMasterKey(sealed, tv.secretKeyB64);

    expect(Buffer.from(opened).equals(Buffer.from(masterKey))).toBe(true);
  });

  it('fails with a wrong secret key', () => {
    const masterKey = generateMasterKey();
    const tv = generateEphemeralKeyPair();
    const other = generateEphemeralKeyPair();

    const sealed = sealMasterKey(masterKey, tv.publicKeyB64);
    expect(() => openSealedMasterKey(sealed, other.secretKeyB64)).toThrow();
  });

  it('produces different ciphertexts for the same inputs (random nonce + ephemeral key)', () => {
    const masterKey = generateMasterKey();
    const tv = generateEphemeralKeyPair();

    const a = sealMasterKey(masterKey, tv.publicKeyB64);
    const b = sealMasterKey(masterKey, tv.publicKeyB64);

    expect(a.sealedB64).not.toBe(b.sealedB64);
    expect(a.publicKeyB64).not.toBe(b.publicKeyB64);
  });
});
