// TwoFaController uses otplib (ESM-only) transitively via TwoFaService.
// We test delegation directly without NestJS module to avoid ESM transform issues.
jest.mock('./services/two-fa.service');
jest.mock('otplib', () => ({}), { virtual: true });
jest.mock('@otplib/plugin-base32-scure', () => ({}), { virtual: true });

import { TwoFaController } from './two-fa.controller';
import { TwoFaService } from './services/two-fa.service';

describe('TwoFaController — delegation', () => {
  let controller: TwoFaController;
  let service: jest.Mocked<TwoFaService>;

  beforeEach(() => {
    service = {
      setupTotp: jest.fn().mockResolvedValue({ qrCode: 'data:...' }),
      verifySetup: jest.fn().mockResolvedValue({ success: true }),
      disableTotp: jest.fn().mockResolvedValue({ success: true }),
      sendEmailOtp: jest.fn().mockResolvedValue({ sent: true }),
      verify: jest.fn().mockResolvedValue({ accessToken: 'jwt' }),
    } as any;
    controller = new TwoFaController(service);
    jest.clearAllMocks();
  });

  it('setup() delegates to service.setupTotp with user id', async () => {
    service.setupTotp.mockResolvedValue({ qrCode: 'data:...' } as any);
    const user = { id: 'u1', email: 'a@b.com', role: 'OFFICER', roleId: 'r1' };
    await controller.setup(user as any);
    expect(service.setupTotp).toHaveBeenCalledWith('u1');
  });

  it('disable() delegates to service.disableTotp with user id', async () => {
    service.disableTotp.mockResolvedValue({ success: true } as any);
    const user = { id: 'u1', email: 'a@b.com', role: 'OFFICER', roleId: 'r1' };
    await controller.disable(user as any);
    expect(service.disableTotp).toHaveBeenCalledWith('u1');
  });

  // Sprint 1 / S1.4 — Regression: 2FA verify must keep its 5/min rate-limit
  // to prevent brute-force của 6-digit OTP space (1M).
  it('verify endpoint keeps @Throttle({ default: { limit: 5, ttl: 60000 } })', () => {
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', TwoFaController.prototype.verify);
    const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', TwoFaController.prototype.verify);
    expect(limit).toBe(5);
    expect(ttl).toBe(60000);
  });

  it('send-email-otp endpoint keeps @Throttle({ default: { limit: 3, ttl: 60000 } })', () => {
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', TwoFaController.prototype.sendEmailOtp);
    const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', TwoFaController.prototype.sendEmailOtp);
    expect(limit).toBe(3);
    expect(ttl).toBe(60000);
  });
});
