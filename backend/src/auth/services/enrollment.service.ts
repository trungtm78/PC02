import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuthService, TokenPair } from '../auth.service';
import { getBcryptCost } from '../utils/password-hash.util';

const ENROLLMENT_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
const TOKEN_BYTES = 32;
const MIN_PASSWORD_LENGTH = 8;
const STRONG_PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/;

/**
 * Magic link enrollment (post-/autoplan).
 *
 * Replace Mode B bulk default password (NIST SP 800-63B §5.1.1.1 violation:
 * shared bcrypt hash cho batch user). Mỗi user 1 token unique, single-use,
 * TTL 72h. User click link → tự đặt password (strong meter validate).
 *
 * Token plaintext KHÔNG bao giờ lưu — chỉ bcrypt hash trên user record.
 * Admin tạo link → trả URL chứa raw token (hiện 1 lần qua modal/copy).
 * Channel để gửi: Zalo cá nhân admin, SMS, email, in QR code — admin chọn.
 */
@Injectable()
export class EnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  async generateEnrollmentLink(
    userId: string,
    actorId: string,
    channelHint?: string,
  ): Promise<{ url: string; qrPayload: string; expiresAt: Date }> {
    // Random URL-safe token (256 bits entropy — brute-force vô vọng).
    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = await bcrypt.hash(rawToken, getBcryptCost());
    const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        enrollmentTokenHash: tokenHash,
        enrollmentExpiresAt: expiresAt,
      },
    });

    await this.prisma.enrollmentTokenAudit.create({
      data: {
        userId,
        generatedBy: actorId,
        expiresAt,
        channelHint: channelHint ?? null,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'ENROLLMENT_TOKEN_GENERATED',
      subject: 'User',
      subjectId: userId,
      metadata: { expiresAt, channelHint },
    });

    const baseUrl = this.config.get<string>('APP_BASE_URL', 'http://171.244.40.245');
    const url = `${baseUrl}/auth/enroll?token=${encodeURIComponent(rawToken)}&uid=${userId}`;
    return { url, qrPayload: url, expiresAt };
  }

  async consumeEnrollmentToken(
    userId: string,
    rawToken: string,
    newPassword: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    if (!user.enrollmentTokenHash || !user.enrollmentExpiresAt) {
      throw new UnauthorizedException(
        'Token không tồn tại hoặc đã được sử dụng. Yêu cầu admin gen link mới.',
      );
    }
    if (user.enrollmentExpiresAt < new Date()) {
      throw new UnauthorizedException(
        'Token đã hết hạn. Yêu cầu admin gen link mới.',
      );
    }
    const tokenValid = await bcrypt.compare(rawToken, user.enrollmentTokenHash);
    if (!tokenValid) {
      // Random 256-bit token — brute-force impossible. KHÔNG count vào failedLoginAttempts.
      throw new UnauthorizedException('Token không hợp lệ');
    }

    // Validate password strength (server-side, defense-in-depth ngoài frontend zxcvbn)
    this.validatePasswordStrength(newPassword);

    const newHash = await bcrypt.hash(newPassword, getBcryptCost());
    const consumedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          enrollmentTokenHash: null, // single-use — consume
          enrollmentExpiresAt: null,
          mustChangePassword: false, // user đã set password mới
          failedLoginAttempts: 0,
          lockedUntil: null,
          tokenVersion: { increment: 1 }, // invalidate old sessions
        },
      });
      await tx.enrollmentTokenAudit.updateMany({
        where: { userId, consumedAt: null },
        data: {
          consumedAt,
          consumedIp: meta.ipAddress,
          consumedUa: meta.userAgent,
        },
      });
    });

    await this.audit.log({
      userId,
      action: 'ENROLLMENT_COMPLETED',
      subject: 'User',
      subjectId: userId,
      metadata: { method: 'magic_link' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Issue real TokenPair — login flow hoàn tất.
    return this.authService.generateTokens(
      user.id,
      user.email ?? user.username,
      user.role.name,
      user.tokenVersion + 1,
      false,
    );
  }

  private validatePasswordStrength(password: string): void {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Mật khẩu phải có tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.`,
      );
    }
    if (!STRONG_PASSWORD_PATTERN.test(password)) {
      throw new BadRequestException(
        'Mật khẩu phải có chữ hoa, chữ số và ký tự đặc biệt (!@#$%^&*).',
      );
    }
  }
}
