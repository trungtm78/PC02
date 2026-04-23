import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');
const bcryptCompare = bcrypt.compare as jest.Mock;
const bcryptHash = bcrypt.hash as jest.Mock;

const HASHED = '$2b$12$hashedpassword';

const mockTx = {
  user: { update: jest.fn() },
};
const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
};
const mockAudit = { log: jest.fn() };

function makeService(): AuthService {
  const svc = Object.create(AuthService.prototype);
  (svc as any).prisma = mockPrisma;
  (svc as any).auditService = mockAudit;
  return svc as AuthService;
}

const META = { ipAddress: '127.0.0.1', userAgent: 'jest' };

describe('AuthService.changePassword', () => {
  let service: AuthService;

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
    bcryptHash.mockResolvedValue(HASHED);
  });

  it('returns success and clears refreshTokenHash on correct password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: HASHED });
    bcryptCompare
      .mockResolvedValueOnce(true)  // currentPassword check
      .mockResolvedValueOnce(false); // same-as-old check (newPassword !== currentPassword hash)
    mockTx.user.update.mockResolvedValue({});
    mockAudit.log.mockResolvedValue(undefined);

    const result = await service.changePassword('u1', { currentPassword: 'Old@1234', newPassword: 'New@5678A' }, META);

    expect(result.success).toBe(true);
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: HASHED, refreshTokenHash: null },
    });
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PASSWORD_CHANGED' }), mockTx);
  });

  it('wraps DB update and audit log in a transaction', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: HASHED });
    bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockTx.user.update.mockResolvedValue({});
    mockAudit.log.mockResolvedValue(undefined);

    await service.changePassword('u1', { currentPassword: 'Old@1234', newPassword: 'New@5678A' }, META);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.user.update).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalled();
  });

  it('throws UnauthorizedException when current password is wrong', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: HASHED });
    bcryptCompare.mockResolvedValue(false);

    await expect(
      service.changePassword('u1', { currentPassword: 'Wrong@1', newPassword: 'New@5678A' }, META),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.changePassword('ghost', { currentPassword: 'Any@1234', newPassword: 'New@5678A' }, META),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when user is inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: false, passwordHash: HASHED });

    await expect(
      service.changePassword('u1', { currentPassword: 'Any@1234', newPassword: 'New@5678A' }, META),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws BadRequestException when user has no local password (OAuth/SSO account)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: null });

    await expect(
      service.changePassword('u1', { currentPassword: 'Any@1234', newPassword: 'New@5678A' }, META),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when newPassword is same as currentPassword (bcrypt compare)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: HASHED });
    bcryptCompare
      .mockResolvedValueOnce(true)  // currentPassword check passes
      .mockResolvedValueOnce(true); // same-as-old check: new == old hash

    await expect(
      service.changePassword('u1', { currentPassword: 'Same@1234', newPassword: 'Same@1234' }, META),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('always includes refreshTokenHash: null in the DB update', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isActive: true, passwordHash: HASHED });
    bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockTx.user.update.mockResolvedValue({});
    mockAudit.log.mockResolvedValue(undefined);

    await service.changePassword('u2', { currentPassword: 'Old@1234', newPassword: 'Diff@9999' }, META);

    const updateCall = mockTx.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data).toHaveProperty('refreshTokenHash', null);
  });
});
