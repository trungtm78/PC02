import {
  KeyRing,
  decryptAesGcm,
  decryptVersioned,
  encryptAesGcm,
  encryptVersioned,
  parseAesKeyHex,
} from './aes-gcm';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

describe('aes-gcm primitives (legacy "iv:ct:tag" format)', () => {
  const key = parseAesKeyHex(KEY_A);

  it('round-trips and uses a fresh IV per call', () => {
    const one = encryptAesGcm('JBSWY3DPEHPK3PXP', key);
    const two = encryptAesGcm('JBSWY3DPEHPK3PXP', key);
    expect(one).not.toBe(two);
    expect(decryptAesGcm(one, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('decrypts a ciphertext produced by the pre-extraction TOTP implementation (regression vector)', () => {
    // Produced with the original TotpEncryptionService algorithm, fixed IV a1b2c3d4e5f60718293a4b5c.
    const legacy =
      'obLD1OX2BxgpOktc:ofE3IcTUGm2JNT1BOviL7w==:WvYBYbVWYKxr9+/RIKg8pA==';
    const legacyKey = parseAesKeyHex(
      '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
    );
    expect(decryptAesGcm(legacy, legacyKey)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('rejects a wrong key', () => {
    const encrypted = encryptAesGcm('secret', key);
    expect(() => decryptAesGcm(encrypted, parseAesKeyHex(KEY_B))).toThrow();
  });

  it('rejects tampered ciphertext and tampered tag', () => {
    const [iv, ct, tag] = encryptAesGcm('secret', key).split(':');
    const flip = (b64: string) => {
      const buf = Buffer.from(b64, 'base64');
      buf[0] = buf[0] ^ 0xff;
      return buf.toString('base64');
    };
    expect(() => decryptAesGcm([iv, flip(ct), tag].join(':'), key)).toThrow();
    expect(() => decryptAesGcm([iv, ct, flip(tag)].join(':'), key)).toThrow();
  });

  it('rejects a malformed string', () => {
    expect(() => decryptAesGcm('notvalid', key)).toThrow(
      'Invalid encrypted format',
    );
  });

  it('rejects keys that are not exactly 32 bytes of hex', () => {
    expect(() => parseAesKeyHex('abcd')).toThrow('32 bytes');
    expect(() => parseAesKeyHex('z'.repeat(64))).toThrow('32 bytes');
  });
});

describe('versioned ciphertext (key rotation)', () => {
  const ringV1 = new KeyRing([{ version: 1, key: parseAesKeyHex(KEY_A) }], 1);
  const ringV2 = new KeyRing(
    [
      { version: 1, key: parseAesKeyHex(KEY_A) },
      { version: 2, key: parseAesKeyHex(KEY_B) },
    ],
    2,
  );

  it('writes the current version as a prefix', () => {
    expect(encryptVersioned('api-key', ringV1).startsWith('v1:')).toBe(true);
    expect(encryptVersioned('api-key', ringV2).startsWith('v2:')).toBe(true);
  });

  it('still decrypts old-version data after the current version moves on', () => {
    const oldCiphertext = encryptVersioned('sk-old', ringV1);
    expect(decryptVersioned(oldCiphertext, ringV2)).toBe('sk-old');
    expect(decryptVersioned(encryptVersioned('sk-new', ringV2), ringV2)).toBe(
      'sk-new',
    );
  });

  it('fails with a clear message when the version is not in the ring', () => {
    const v2 = encryptVersioned('sk-new', ringV2);
    expect(() => decryptVersioned(v2, ringV1)).toThrow('key version 2');
  });

  it('rejects an unversioned string', () => {
    expect(() =>
      decryptVersioned(encryptAesGcm('x', parseAesKeyHex(KEY_A)), ringV1),
    ).toThrow('Invalid versioned format');
  });

  it('rejects a ring whose current version has no key, or with duplicate versions', () => {
    expect(
      () => new KeyRing([{ version: 1, key: parseAesKeyHex(KEY_A) }], 2),
    ).toThrow('current version');
    expect(
      () =>
        new KeyRing(
          [
            { version: 1, key: parseAesKeyHex(KEY_A) },
            { version: 1, key: parseAesKeyHex(KEY_B) },
          ],
          1,
        ),
    ).toThrow('duplicate');
  });
});
