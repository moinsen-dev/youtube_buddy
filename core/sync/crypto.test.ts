import {
  decryptPayload,
  encryptPayload,
  formatRecoveryCode,
  generateMasterKey,
  generateRecoveryCode,
  MASTER_KEY_BYTES,
  normalizeRecoveryCode,
  RECOVERY_CODE_LENGTH,
  unwrapMasterKey,
  wrapMasterKey,
} from './crypto';

describe('sync crypto (E2E)', () => {
  it('encrypt/decrypt round-trips arbitrary JSON', () => {
    const key = generateMasterKey();
    const payload = { id: 42, title: 'Notiz mit Ümläuten 🎬', nested: { list: [1, 2, 3] } };
    const ciphertext = encryptPayload(key, payload);
    expect(ciphertext).not.toContain('Notiz');
    expect(decryptPayload(key, ciphertext)).toEqual(payload);
  });

  it('fails decryption with a different key (authentication)', () => {
    const ciphertext = encryptPayload(generateMasterKey(), { a: 1 });
    expect(() => decryptPayload(generateMasterKey(), ciphertext)).toThrow();
  });

  it('wrap/unwrap round-trips the master key via recovery code', async () => {
    const masterKey = generateMasterKey();
    const code = generateRecoveryCode();
    const wrapped = await wrapMasterKey(masterKey, code);
    expect(wrapped.length).toBeGreaterThan(MASTER_KEY_BYTES);
    const unwrapped = await unwrapMasterKey(wrapped, code);
    expect(Array.from(unwrapped)).toEqual(Array.from(masterKey));
  });

  it('rejects a wrong recovery code', async () => {
    const wrapped = await wrapMasterKey(generateMasterKey(), generateRecoveryCode());
    await expect(unwrapMasterKey(wrapped, generateRecoveryCode())).rejects.toThrow();
  });

  it('recovery code helpers: format, normalize, alphabet without lookalikes', () => {
    const code = generateRecoveryCode();
    expect(code).toHaveLength(RECOVERY_CODE_LENGTH);
    expect(code).not.toMatch(/[01IOL]/); // no ambiguous characters
    const formatted = formatRecoveryCode(code);
    expect(formatted).toMatch(/^(.{4}-){5}.{4}$/);
    expect(normalizeRecoveryCode(formatted.toLowerCase() + ' ')).toBe(code);
  });
});
