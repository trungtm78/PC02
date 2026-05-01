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
});
