import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // AES-256-GCM standard IV length
const KEY_LENGTH = 32;
const KEY_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;
const VERSION_PREFIX = /^v(\d+):(.+)$/s;

/** Parses a 64-character hex string into a 32-byte AES key. */
export function parseAesKeyHex(hex: string): Buffer {
  if (!KEY_HEX_PATTERN.test(hex)) {
    throw new Error('AES key must be 32 bytes encoded as 64 hex characters');
  }
  return Buffer.from(hex, 'hex');
}

function assertKey(key: Buffer): void {
  if (key.length !== KEY_LENGTH) {
    throw new Error('AES key must be 32 bytes');
  }
}

/**
 * Encrypts to "iv:ciphertext:authTag", all base64.
 *
 * WIRE FORMAT: stored TOTP secrets use exactly this shape. Do not change it without a migration.
 */
export function encryptAesGcm(plaintext: string, key: Buffer): string {
  assertKey(key);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, encrypted, authTag].map((part) => part.toString('base64')).join(':');
}

export function decryptAesGcm(stored: string, key: Buffer): string {
  assertKey(key);
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const [iv, ciphertext, authTag] = parts.map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export interface VersionedKey {
  version: number;
  key: Buffer;
}

/**
 * Keys by version so a key can be rotated without re-encrypting everything at once:
 * new data uses `currentVersion`, old data still decrypts with the key it was written under.
 */
export class KeyRing {
  private readonly keys = new Map<number, Buffer>();

  constructor(
    keys: readonly VersionedKey[],
    readonly currentVersion: number,
  ) {
    for (const { version, key } of keys) {
      if (this.keys.has(version)) throw new Error(`duplicate key version ${version}`);
      assertKey(key);
      this.keys.set(version, key);
    }
    if (!this.keys.has(currentVersion)) {
      throw new Error(`current version ${currentVersion} has no key in the ring`);
    }
  }

  keyFor(version: number): Buffer {
    const key = this.keys.get(version);
    if (!key) throw new Error(`key version ${version} is not available in this ring`);
    return key;
  }
}

/** Encrypts under the ring's current key; output is "v<version>:iv:ciphertext:authTag". */
export function encryptVersioned(plaintext: string, ring: KeyRing): string {
  const body = encryptAesGcm(plaintext, ring.keyFor(ring.currentVersion));
  return `v${ring.currentVersion}:${body}`;
}

export function decryptVersioned(stored: string, ring: KeyRing): string {
  const match = VERSION_PREFIX.exec(stored);
  if (!match) throw new Error('Invalid versioned format');
  return decryptAesGcm(match[2], ring.keyFor(Number(match[1])));
}
