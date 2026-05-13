import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import type { JwtPayload } from './jwt.strategy';

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('./keys/public.pem'),
};

// We need to test the validate method directly
// The constructor reads the public key file, so we mock the strategy
describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    // Create strategy instance by calling validate directly
    // We bypass the constructor's file read by creating a minimal instance
    strategy = Object.create(JwtStrategy.prototype);
    (strategy as any).prisma = mockPrisma;
    jest.clearAllMocks();
  });

  describe('validate', () => {
    const validPayload: JwtPayload = {
      sub: 'user-1',
      email: 'test@pc02.local',
      role: 'ADMIN',
    };

    const mockUser = {
      id: 'user-1',
      email: 'test@pc02.local',
      username: 'admin',
      isActive: true,
      tokenVersion: 0,
      roleId: 'role-1',
      role: { name: 'ADMIN' },
    };

    it('should reject refresh tokens used as access tokens', async () => {
      const refreshPayload: JwtPayload = {
        ...validPayload,
        type: 'refresh',
      };

      await expect(strategy.validate(refreshPayload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(refreshPayload)).rejects.toThrow(
        'Refresh tokens cannot be used for API access',
      );
      // Should NOT query database at all
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should accept valid access tokens (no type field)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(validPayload);

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@pc02.local',
        username: 'admin',
        role: 'ADMIN',
        roleId: 'role-1',
      });
    });

    it('should reject inactive users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(strategy.validate(validPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject non-existent users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(validPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject tokens with stale tokenVersion (issued before password change)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, tokenVersion: 1 });
      const stalePayload: JwtPayload = { ...validPayload, tokenVersion: 0 };

      await expect(strategy.validate(stalePayload)).rejects.toThrow(UnauthorizedException);
    });

    it('should accept tokens whose tokenVersion matches the current user version', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, tokenVersion: 2 });
      const freshPayload: JwtPayload = { ...validPayload, tokenVersion: 2 };

      const result = await strategy.validate(freshPayload);
      expect(result.id).toBe('user-1');
    });

    it('should treat missing tokenVersion in payload as 0 (backward compat)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, tokenVersion: 0 });
      const legacyPayload: JwtPayload = { ...validPayload }; // no tokenVersion field

      const result = await strategy.validate(legacyPayload);
      expect(result.id).toBe('user-1');
    });

    // C1 — pre-existing JwtAuthGuard bug fix
    // Pending tokens (2fa_pending, change_password_pending) must NOT be usable as access tokens.
    // Reason: previously only `type === 'refresh'` was rejected, so a leaked twoFaToken or
    // changePasswordToken could be presented as Authorization: Bearer to call business APIs.
    it('should reject 2fa_pending tokens used as access tokens', async () => {
      const pendingPayload: JwtPayload = {
        ...validPayload,
        type: '2fa_pending',
      };

      await expect(strategy.validate(pendingPayload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(pendingPayload)).rejects.toThrow(
        'Pending tokens cannot be used for API access',
      );
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should reject change_password_pending tokens used as access tokens', async () => {
      const pendingPayload: JwtPayload = {
        ...validPayload,
        type: 'change_password_pending',
      };

      await expect(strategy.validate(pendingPayload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(pendingPayload)).rejects.toThrow(
        'Pending tokens cannot be used for API access',
      );
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should accept tokens with explicit type=access', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const explicitAccess: JwtPayload = {
        ...validPayload,
        type: 'access',
      };

      const result = await strategy.validate(explicitAccess);
      expect(result.id).toBe('user-1');
    });
  });
});
