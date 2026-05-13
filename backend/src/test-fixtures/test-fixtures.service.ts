import { Injectable, NotFoundException } from '@nestjs/common';
import {
  generateSecret as totpGenerateSecret,
  generate as totpGenerate,
} from 'otplib';
import { PrismaService } from '../prisma/prisma.service';
import { TotpEncryptionService } from '../auth/services/totp-encryption.service';
import { hashPassword } from '../auth/utils/password-hash.util';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { SeedTestUserDto, E2E_EMAIL_PATTERN } from './dto/seed-test-user.dto';

export interface SeededTestUser {
  userId: string;
  email: string;
  mustChangePassword: boolean;
  twoFaEnabled: boolean;
  tokenVersion: number;
  /** Returned ONLY when twoFaEnabled=true so Maestro flow can submit a valid OTP. */
  currentTotpCode?: string;
  /** Returned ONLY when twoFaEnabled=true so flow can regenerate after window roll. */
  totpSecret?: string;
}

/**
 * Idempotent test fixture: upsert a single test user matching the e2e+*
 * email pattern, set its state (force-change / 2FA / tokenVersion bump),
 * and return enough info for Maestro to drive the resulting flow.
 *
 * SAFETY: caller is gated by TestModeGuard. This service trusts that gate.
 * It STILL revalidates the email pattern at the service boundary because
 * Codex F4 / Claude F2 patterns showed boundary trust is brittle.
 */
@Injectable()
export class TestFixturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly totpEncryption: TotpEncryptionService,
  ) {}

  async seedUser(dto: SeedTestUserDto): Promise<SeededTestUser> {
    if (!E2E_EMAIL_PATTERN.test(dto.email)) {
      // Defense in depth: DTO already validates, but reject here too so a
      // future direct service caller cannot bypass class-validator.
      throw new NotFoundException('e2e email pattern mismatch');
    }

    const investigatorRole = await this.prisma.role.findFirst({
      where: { name: ROLE_NAMES.INVESTIGATOR },
      select: { id: true },
    });
    if (!investigatorRole) {
      throw new NotFoundException(
        'Investigator role not seeded — run npm run db:seed first',
      );
    }

    const passwordHash = await hashPassword(dto.password);

    // 2FA setup is the same encryption path the real /2fa/setup uses.
    let encryptedTotpSecret: string | null = null;
    let plaintextTotpSecret: string | null = null;
    if (dto.twoFaEnabled) {
      plaintextTotpSecret = totpGenerateSecret();
      encryptedTotpSecret = this.totpEncryption.encrypt(plaintextTotpSecret);
    }

    // upsert by username (we use email-prefix as username for e2e users)
    const username = dto.email.split('@')[0];

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, tokenVersion: true },
    });

    let user;
    if (existing) {
      // Bump tokenVersion when caller requests OR when password changes,
      // so any previously-issued JWT is rejected. Mirrors auth.service
      // /admin/reset-password semantics from v0.21.
      const newTokenVersion = dto.bumpTokenVersion
        ? existing.tokenVersion + 1
        : existing.tokenVersion;

      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          tokenVersion: newTokenVersion,
          mustChangePassword: dto.mustChangePassword ?? false,
          totpEnabled: dto.twoFaEnabled ?? false,
          totpSecret: encryptedTotpSecret,
          totpSetupPending: false,
          totpSetupPendingAt: null,
          twoFaUsedAt: null,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          tokenVersion: true,
          mustChangePassword: true,
          totpEnabled: true,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          username,
          passwordHash,
          firstName: 'E2E',
          lastName: 'Test',
          roleId: investigatorRole.id,
          mustChangePassword: dto.mustChangePassword ?? false,
          totpEnabled: dto.twoFaEnabled ?? false,
          totpSecret: encryptedTotpSecret,
          tokenVersion: 0,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          tokenVersion: true,
          mustChangePassword: true,
          totpEnabled: true,
        },
      });
    }

    return {
      userId: user.id,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
      twoFaEnabled: user.totpEnabled,
      tokenVersion: user.tokenVersion,
      currentTotpCode: plaintextTotpSecret
        ? await totpGenerate({ secret: plaintextTotpSecret })
        : undefined,
      totpSecret: plaintextTotpSecret ?? undefined,
    };
  }

  /**
   * Compute a TOTP code on demand for a user — used by Maestro flows that
   * already seeded a user and need a fresh code after the 30s window rolls.
   */
  async currentTotpCode(email: string): Promise<{ code: string }> {
    if (!E2E_EMAIL_PATTERN.test(email)) {
      throw new NotFoundException();
    }
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { totpSecret: true },
    });
    if (!user?.totpSecret) {
      throw new NotFoundException('no totp secret for user');
    }
    const decrypted = this.totpEncryption.decrypt(user.totpSecret);
    return { code: await totpGenerate({ secret: decrypted }) };
  }

  /** Hard-delete every e2e+* user. Called by CI between runs. */
  async deleteAllE2eUsers(): Promise<{ deleted: number }> {
    const result = await this.prisma.user.deleteMany({
      where: { email: { startsWith: 'e2e+' } },
    });
    return { deleted: result.count };
  }
}
