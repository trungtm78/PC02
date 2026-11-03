import { decryptVersioned, encryptVersioned } from '../common/crypto/aes-gcm';
import { isLlmKeyConfigured, loadLlmKeyRing } from './llm-key-ring';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

describe('loadLlmKeyRing', () => {
  it('uses LLM_KEY_ENCRYPTION_KEY as version 1 when no version is given', () => {
    const ring = loadLlmKeyRing({ LLM_KEY_ENCRYPTION_KEY: KEY_A });
    expect(ring.currentVersion).toBe(1);
    expect(decryptVersioned(encryptVersioned('sk-1', ring), ring)).toBe('sk-1');
  });

  it('writes under the current version and still reads the previous one', () => {
    const before = loadLlmKeyRing({ LLM_KEY_ENCRYPTION_KEY: KEY_A });
    const stored = encryptVersioned('sk-old', before);

    const after = loadLlmKeyRing({
      LLM_KEY_ENCRYPTION_KEY: KEY_B,
      LLM_KEY_VERSION: '2',
      LLM_KEY_ENCRYPTION_KEY_V1: KEY_A,
    });
    expect(after.currentVersion).toBe(2);
    expect(encryptVersioned('sk-new', after).startsWith('v2:')).toBe(true);
    expect(decryptVersioned(stored, after)).toBe('sk-old');
  });

  it('refuses to start without the key, naming the variable', () => {
    expect(() => loadLlmKeyRing({})).toThrow(
      'LLM_KEY_ENCRYPTION_KEY is required',
    );
  });

  it('refuses a key that is not 32 bytes of hex', () => {
    expect(() => loadLlmKeyRing({ LLM_KEY_ENCRYPTION_KEY: 'short' })).toThrow(
      '32 bytes',
    );
  });

  it('refuses a non-numeric or non-positive version', () => {
    expect(() =>
      loadLlmKeyRing({ LLM_KEY_ENCRYPTION_KEY: KEY_A, LLM_KEY_VERSION: 'two' }),
    ).toThrow('LLM_KEY_VERSION');
    expect(() =>
      loadLlmKeyRing({ LLM_KEY_ENCRYPTION_KEY: KEY_A, LLM_KEY_VERSION: '0' }),
    ).toThrow('LLM_KEY_VERSION');
  });

  it('a previous key with the same version as the current one is a configuration error', () => {
    expect(() =>
      loadLlmKeyRing({
        LLM_KEY_ENCRYPTION_KEY: KEY_A,
        LLM_KEY_VERSION: '1',
        LLM_KEY_ENCRYPTION_KEY_V1: KEY_B,
      }),
    ).toThrow('duplicate');
  });

  it('the error never contains the key material', () => {
    try {
      loadLlmKeyRing({ LLM_KEY_ENCRYPTION_KEY: 'zz' + KEY_A.slice(2) });
    } catch (error) {
      expect((error as Error).message).not.toContain(KEY_A.slice(2));
    }
  });
});

describe('isLlmKeyConfigured', () => {
  it('is true only when a usable key ring can be built', () => {
    expect(isLlmKeyConfigured({ LLM_KEY_ENCRYPTION_KEY: KEY_A })).toBe(true);
    expect(isLlmKeyConfigured({})).toBe(false);
    expect(isLlmKeyConfigured({ LLM_KEY_ENCRYPTION_KEY: 'nope' })).toBe(false);
  });
});
