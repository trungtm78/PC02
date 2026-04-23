import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockService = {
  changePassword: jest.fn(),
  login: jest.fn(),
  refreshToken: jest.fn(),
};

function makeReq(user: unknown = { id: 'u1', email: 'a@b.com', role: 'OFFICER' }) {
  return { user, ip: '127.0.0.1', headers: { 'user-agent': 'jest' } } as any;
}

describe('AuthController — changePassword wiring', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockService }],
    })
      .overrideGuard(require('./guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('./guards/user-throttler.guard').UserThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuthController);
    jest.clearAllMocks();
  });

  it('forwards user.id to service', () => {
    mockService.changePassword.mockResolvedValue({ success: true, message: 'ok' });
    const dto = { currentPassword: 'Old@1', newPassword: 'New@1' };
    controller.changePassword(dto as any, { id: 'u1', email: 'a@b.com', role: 'OFFICER', roleId: 'r1' }, makeReq());
    expect(mockService.changePassword).toHaveBeenCalledWith('u1', dto, expect.any(Object));
  });

  it('forwards ip and userAgent to service', () => {
    mockService.changePassword.mockResolvedValue({ success: true, message: 'ok' });
    const dto = { currentPassword: 'Old@1', newPassword: 'New@1' };
    controller.changePassword(dto as any, { id: 'u2', email: 'b@c.com', role: 'OFFICER', roleId: 'r1' }, makeReq());
    expect(mockService.changePassword).toHaveBeenCalledWith(
      'u2',
      dto,
      { ipAddress: '127.0.0.1', userAgent: 'jest' },
    );
  });

  it('returns service result', async () => {
    const expected = { success: true, message: 'Mật khẩu đã được cập nhật thành công' };
    mockService.changePassword.mockResolvedValue(expected);
    const result = await controller.changePassword(
      { currentPassword: 'Old@1', newPassword: 'New@1' } as any,
      { id: 'u1', email: 'a@b.com', role: 'OFFICER', roleId: 'r1' },
      makeReq(),
    );
    expect(result).toEqual(expected);
  });
});
