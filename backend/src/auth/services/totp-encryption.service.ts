import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SettingsService } from '../../settings/settings.service';

const IV_LENGTH = 12; // AES-256-GCM standard IV length
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class TotpEncryptionService implements OnModuleInit {
  private keyBuffer: Buffer | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const keyHex = this.config.get<string>('TOTP_ENCRYPTION_KEY');
    if (keyHex) {
      this.keyBuffer = Buffer.from(keyHex, 'hex');
    }

    const enabled = await this.settings.getValue('TWO_FA_ENABLED');
    if (enabled === 'true' && !keyHex) {
      throw new Error('TOTP_ENCRYPTION_KEY is required when TWO_FA_ENABLED=true');
    }
  }

  private getKey(): Buffer {
    if (!this.keyBuffer) {
      throw new Error('TOTP_ENCRYPTION_KEY not configured');
    }
    return this.keyBuffer;
  }

  // Returns "iv:ciphertext:authTag" — all base64
  encrypt(plaintext: string): string {
    const key = this.getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      encrypted.toString('base64'),
      authTag.toString('base64'),
    ].join(':');
  }

  decrypt(stored: string): string {
    const key = this.getKey();
    const parts = stored.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');
    const [ivB64, ciphertextB64, authTagB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }
}
