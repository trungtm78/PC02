import { TotpEncryptionService } from './totp-encryption.service';

const TEST_KEY = 'a'.repeat(64); // 32 bytes as hex

function makeSvc(keyHex?: string) {
  const config = { get: jest.fn().mockReturnValue(keyHex ?? TEST_KEY) } as any;
  const settings = { getValue: jest.fn().mockResolvedValue('false') } as any;
  return new TotpEncryptionService(config, settings);
}

describe('TotpEncryptionService', () => {
  let svc: TotpEncryptionService;

  beforeEach(async () => {
    svc = makeSvc();
    await svc.onModuleInit();
  });

  it('encrypt → decrypt roundtrip returns original plaintext', () => {
    const secret = 'JBSWY3DPEHPK3PXP'; // base32 TOTP secret
    const encrypted = svc.encrypt(secret);
    expect(svc.decrypt(encrypted)).toBe(secret);
  });

  it('two encryptions of same plaintext produce different ciphertext (random IV)', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const enc1 = svc.encrypt(secret);
    const enc2 = svc.encrypt(secret);
    expect(enc1).not.toBe(enc2);
  });

  it('decrypt with wrong key throws', async () => {
    const svc2 = makeSvc('b'.repeat(64));
    await svc2.onModuleInit();
    const encrypted = svc.encrypt('secret');
    expect(() => svc2.decrypt(encrypted)).toThrow();
  });

  it('decrypt with invalid format throws', () => {
    expect(() => svc.decrypt('notvalid')).toThrow('Invalid encrypted format');
  });

  it('onModuleInit throws when TWO_FA_ENABLED=true and key missing', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as any;
    const settings = { getValue: jest.fn().mockResolvedValue('true') } as any;
    const svc2 = new TotpEncryptionService(config, settings);
    await expect(svc2.onModuleInit()).rejects.toThrow('TOTP_ENCRYPTION_KEY');
  });

  it('onModuleInit succeeds when TWO_FA_ENABLED=false and key missing', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as any;
    const settings = { getValue: jest.fn().mockResolvedValue('false') } as any;
    const svc2 = new TotpEncryptionService(config, settings);
    await expect(svc2.onModuleInit()).resolves.not.toThrow();
  });
});
