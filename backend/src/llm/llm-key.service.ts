import { HttpStatus, Injectable } from '@nestjs/common';
import {
  decryptVersioned,
  encryptVersioned,
  type KeyRing,
} from '../common/crypto/aes-gcm';
import { LlmAdminError } from './llm-admin-error';
import { isLlmKeyConfigured, loadLlmKeyRing } from './llm-key-ring';

/** Encrypts and decrypts stored provider API keys with the key ring from the environment. */
@Injectable()
export class LlmKeyService {
  private ring: KeyRing | null = null;

  isConfigured(): boolean {
    return isLlmKeyConfigured(process.env);
  }

  encrypt(plain: string): string {
    return encryptVersioned(plain, this.getRing());
  }

  decrypt(stored: string): string {
    return decryptVersioned(stored, this.getRing());
  }

  private getRing(): KeyRing {
    if (this.ring) return this.ring;
    try {
      this.ring = loadLlmKeyRing(process.env);
    } catch {
      throw new LlmAdminError(
        'LLM_KEY_NOT_CONFIGURED',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.ring;
  }
}
