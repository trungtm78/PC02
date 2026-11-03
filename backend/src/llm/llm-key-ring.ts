import {
  KeyRing,
  parseAesKeyHex,
  type VersionedKey,
} from '../common/crypto/aes-gcm';

const CURRENT_KEY_VAR = 'LLM_KEY_ENCRYPTION_KEY';
const VERSION_VAR = 'LLM_KEY_VERSION';
const PREVIOUS_KEY_PATTERN = /^LLM_KEY_ENCRYPTION_KEY_V(\d+)$/;

export type Env = Readonly<Record<string, string | undefined>>;

/**
 * Builds the key ring that protects stored provider API keys.
 *
 * `LLM_KEY_ENCRYPTION_KEY` is the current key and `LLM_KEY_VERSION` its version (default 1). To rotate: set
 * the new key as the current one with the next version, and keep the old key as `LLM_KEY_ENCRYPTION_KEY_V<old>`
 * so existing ciphertext still decrypts; once every stored key has been re-saved, drop the old variable.
 *
 * Errors name the variable and never include key material.
 */
export function loadLlmKeyRing(env: Env): KeyRing {
  const currentHex = env[CURRENT_KEY_VAR];
  if (!currentHex) throw new Error(`${CURRENT_KEY_VAR} is required`);

  const version = readVersion(env[VERSION_VAR]);
  const keys: VersionedKey[] = [
    { version, key: parseKey(CURRENT_KEY_VAR, currentHex) },
  ];

  for (const [name, value] of Object.entries(env)) {
    const match = PREVIOUS_KEY_PATTERN.exec(name);
    if (!match || !value) continue;
    keys.push({ version: Number(match[1]), key: parseKey(name, value) });
  }
  return new KeyRing(keys, version);
}

/** True when a usable key ring can be built from the environment. */
export function isLlmKeyConfigured(env: Env): boolean {
  try {
    loadLlmKeyRing(env);
    return true;
  } catch {
    return false;
  }
}

function readVersion(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 1;
  const version = Number(raw);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`${VERSION_VAR} must be a positive integer`);
  }
  return version;
}

function parseKey(variable: string, hex: string): Buffer {
  try {
    return parseAesKeyHex(hex);
  } catch {
    throw new Error(
      `${variable} must be 32 bytes encoded as 64 hex characters`,
    );
  }
}
