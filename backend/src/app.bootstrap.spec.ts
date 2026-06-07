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
import { AppModule } from './app.module';

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
