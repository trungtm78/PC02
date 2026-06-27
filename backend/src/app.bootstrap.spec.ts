// Mock các package ESM-only (otplib → @scure/base, qrcode) để jest gate mặc định
// không phải transform chuỗi ESM trong node_modules.
// Shape PHẢI KHỚP Y HỆT two-fa.service.spec.ts: import AppModule ở đây compile
// two-fa.service vào registry worker (resetModules:false) → nếu mock lệch shape sẽ
// leak làm two-fa.service.spec fail. Giữ trùng để mọi leak là benign.
jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateURI: jest
    .fn()
    .mockReturnValue('otpauth://totp/PC02:user@test.com?secret=JBSWY3DPEHPK3PXP&issuer=PC02'),
  verify: jest.fn().mockResolvedValue({ valid: true }),
  generate: jest.fn().mockResolvedValue('123456'),
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fake') }));

import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppModule } from './app.module';

// AuthService/guards đọc JWT key file trong constructor → CI không có ./keys/private.pem (gitignored).
// Sinh keypair ephemeral + trỏ env vào đó để full DI graph compile được ở mọi môi trường.
let __privPath: string;
let __pubPath: string;
beforeAll(() => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const dir = os.tmpdir();
  __privPath = path.join(dir, `pc02-test-priv-${process.pid}.pem`);
  __pubPath = path.join(dir, `pc02-test-pub-${process.pid}.pem`);
  fs.writeFileSync(__privPath, privateKey);
  fs.writeFileSync(__pubPath, publicKey);
  process.env.JWT_PRIVATE_KEY_PATH = __privPath;
  process.env.JWT_PUBLIC_KEY_PATH = __pubPath;
});
afterAll(() => {
  for (const p of [__privPath, __pubPath]) {
    try {
      if (p) fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
});

/**
 * Bootstrap guard — biên dịch toàn bộ DI graph của AppModule.
 *
 * Bài học (feat/legacy-parity-migration): LegacyMigrationModule thêm provider
 * phụ thuộc AuditService nhưng QUÊN import AuditModule → app KHÔNG boot được
 * (UnknownDependenciesException), trong khi 2134 unit test + tsc vẫn xanh vì
 * unit test không dựng full Nest app, còn app.e2e-spec.ts (có dựng) lại nằm ở
 * test/ chạy bằng jest-e2e config riêng — KHÔNG thuộc gate `npx jest` mặc định.
 *
 * Test này nằm trong src/ nên thuộc gate chính. Dùng .compile() (KHÔNG .init())
 * → chỉ resolve constructor toàn graph, không mở kết nối DB/onModuleInit, nên
 * chạy nhanh và không cần DB. Bất kỳ module nào wiring DI thiếu sẽ fail tại đây.
 */
describe('AppModule bootstrap (DI graph)', () => {
  it('resolve được toàn bộ dependency graph (mọi module wiring đầy đủ)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
