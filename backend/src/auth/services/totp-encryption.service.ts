import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';
import { SETTINGS_KEY } from '../../common/constants/settings-keys.constants';
import { decryptAesGcm, encryptAesGcm } from '../../common/crypto/aes-gcm';

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

    const enabled = await this.settings.getValue(SETTINGS_KEY.TWO_FA_ENABLED);
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
    return encryptAesGcm(plaintext, this.getKey());
  }

  decrypt(stored: string): string {
    return decryptAesGcm(stored, this.getKey());
  }
}
