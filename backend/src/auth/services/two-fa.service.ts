import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { generateSecret as totpGenerateSecret, verify as totpVerify, generateURI as totpGenerateURI } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { TotpEncryptionService } from './totp-encryption.service';
import { OtpCodeService } from './otp-code.service';
import { EmailService } from '../../email/email.service';
import { SettingsService } from '../../settings/settings.service';
import type { TokenPair } from '../auth.service';

const SETUP_PENDING_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class TwoFaService {
  private readonly privateKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly encryption: TotpEncryptionService,
    private readonly otpCode: OtpCodeService,
    private readonly email: EmailService,
    private readonly settings: SettingsService,
  ) {
    const privateKeyPath = this.config.get<string>(
      'JWT_PRIVATE_KEY_PATH',
      './keys/private.pem',
    );
    this.privateKey = fs.readFileSync(path.resolve(privateKeyPath), 'utf-8');
  }

  // ── Setup TOTP ─────────────────────────────────────────────────────────────
  async setupTotp(userId: string): Promise<{ qrCodeDataUrl: string; backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, totpEnabled: true, totpSetupPending: true, totpSetupPendingAt: true },
    });
    if (!user) throw new UnauthorizedException();

    if (user.totpEnabled) {
      throw new ConflictException('2FA đã được kích hoạt');
    }

    // ISSUE-006: lazy cleanup of abandoned setup after 24h
    if (user.totpSetupPending && user.totpSetupPendingAt) {
      const age = Date.now() - user.totpSetupPendingAt.getTime();
      if (age > SETUP_PENDING_TTL_MS) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { totpSetupPending: false, totpSecret: null, totpSetupPendingAt: null },
        });
      } else {
        throw new ConflictException('Setup đang chờ xác nhận. Kiểm tra QR code trước đó.');
      }
    }

    // Generate TOTP secret
    const secret = totpGenerateSecret();
    const encryptedSecret = this.encryption.encrypt(secret);

    // Generate 10 backup codes (12-char hex each)
    const plainCodes: string[] = [];
    const backupCodes: string[] = [];
    const backupCodeSalts: string[] = [];

    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(6).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHash('sha256').update(salt + code).digest('hex');
      plainCodes.push(code);
      backupCodes.push(hash);
      backupCodeSalts.push(salt);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: encryptedSecret,
        totpSetupPending: true,
        totpSetupPendingAt: new Date(),
        backupCodes,
        backupCodeSalts,
      },
    });

    const otpUri = totpGenerateURI({ label: user.email, issuer: 'PC02', secret, strategy: 'totp' });
    const qrCodeDataUrl = await QRCode.toDataURL(otpUri);

    return { qrCodeDataUrl, backupCodes: plainCodes };
  }

  // ── Verify Setup ───────────────────────────────────────────────────────────
  async verifySetup(userId: string, token: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, totpSetupPending: true, totpSecret: true },
    });
    if (!user) throw new UnauthorizedException();

    if (!user.totpSetupPending || !user.totpSecret) {
      throw new BadRequestException('Chưa khởi tạo setup TOTP. Gọi /auth/2fa/setup trước.');
    }

    const secret = this.encryption.decrypt(user.totpSecret);
    const verifyResult = await totpVerify({ token, secret, strategy: 'totp', epochTolerance: 30 });
    if (!verifyResult.valid) {
      throw new BadRequestException('Mã TOTP không hợp lệ');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: true,
        totpSetupPending: false,
        totpSetupPendingAt: null,
        twoFaSetupAt: new Date(),
      },
    });

    await this.audit.log({
      userId,
      action: 'USER_2FA_SETUP',
      subject: 'User',
      subjectId: userId,
    });
  }

  // ── Send Email OTP ─────────────────────────────────────────────────────────
  async sendEmailOtp(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new UnauthorizedException();

    const code = await this.otpCode.generate(userId);
    await this.email.sendTwoFaOtp(user.email, code);
  }

  // ── Verify 2FA ─────────────────────────────────────────────────────────────
  async verify(
    userId: string,
    dto: { code: string; method: 'totp' | 'email_otp' | 'backup' },
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();

    let verified = false;

    if (dto.method === 'totp') {
      verified = await this.verifyTotp(user, dto.code, meta);
    } else if (dto.method === 'email_otp') {
      verified = await this.verifyEmailOtp(userId, dto.code, meta);
    } else if (dto.method === 'backup') {
      verified = await this.verifyBackup(user, dto.code, meta);
    }

    if (!verified) {
      await this.audit.log({
        userId,
        action: 'USER_2FA_FAILED',
        subject: 'User',
        subjectId: userId,
        metadata: { method: dto.method },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Mã xác thực không hợp lệ');
    }

    // OV-002: mark twoFaToken as consumed (persisted — survives restart)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaUsedAt: new Date(), lastLoginAt: new Date() },
    });

    await this.audit.log({
      userId,
      action: 'USER_2FA_VERIFIED',
      subject: 'User',
      subjectId: userId,
      metadata: { method: dto.method },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // USER_LOGIN fires here (after both factors) — NOT in AuthService.login()
    await this.audit.log({
      userId,
      action: 'USER_LOGIN',
      subject: 'User',
      subjectId: userId,
      metadata: { email: user.email, role: user.role.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.generateTokenPair(user);
  }

  private async verifyTotp(
    user: { id: string; totpEnabled: boolean; totpSecret: string | null; lastTotpCode: string | null },
    code: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<boolean> {
    if (!user.totpEnabled || !user.totpSecret) return false;

    const secret = this.encryption.decrypt(user.totpSecret);
    const totpResult = await totpVerify({ token: code, secret, strategy: 'totp', epochTolerance: 30 });
    if (!totpResult.valid) return false;

    // Atomic replay protection — UPDATE only if lastTotpCode != code
    const updated = await this.prisma.$executeRaw`
      UPDATE "users" SET "lastTotpCode" = ${code}
      WHERE id = ${user.id} AND ("lastTotpCode" != ${code} OR "lastTotpCode" IS NULL)
    `;
    if (updated === 0) {
      throw new ForbiddenException('Code đã được sử dụng trong cùng window');
    }

    return true;
  }

  private async verifyEmailOtp(
    userId: string,
    code: string,
    _meta: { ipAddress?: string; userAgent?: string },
  ): Promise<boolean> {
    return this.otpCode.verify(userId, code);
  }

  private async verifyBackup(
    user: { id: string; backupCodes: string[]; backupCodeSalts: string[] },
    code: string,
    _meta: { ipAddress?: string; userAgent?: string },
  ): Promise<boolean> {
    if (user.backupCodes.length === 0) return false;

    let matchIdx = -1;

    // OV-004: iterate ALL codes without early exit; use timingSafeEqual
    for (let i = 0; i < user.backupCodes.length; i++) {
      const computed = crypto
        .createHash('sha256')
        .update(user.backupCodeSalts[i] + code)
        .digest('hex');

      const isMatch = crypto.timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(user.backupCodes[i], 'hex'),
      );
      if (isMatch) matchIdx = i;
    }

    if (matchIdx === -1) return false;

    // Consume the matched code — single Prisma update (atomic for both arrays)
    const newCodes = user.backupCodes.filter((_, i) => i !== matchIdx);
    const newSalts = user.backupCodeSalts.filter((_, i) => i !== matchIdx);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { backupCodes: newCodes, backupCodeSalts: newSalts },
    });

    return true;
  }

  // ── Disable TOTP (user self-service, only when 2FA system is off) ──────────
  async disableTotp(userId: string): Promise<void> {
    const is2FAEnabled = await this.settings.getValue('TWO_FA_ENABLED') === 'true';
    if (is2FAEnabled) {
      throw new BadRequestException('Không thể tắt 2FA khi hệ thống yêu cầu 2FA bắt buộc');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: null,
        totpEnabled: false,
        totpSetupPending: false,
        totpSetupPendingAt: null,
        backupCodes: [],
        backupCodeSalts: [],
        lastTotpCode: null,
        twoFaSetupAt: null,
      },
    });

    await this.audit.log({
      userId,
      action: 'USER_2FA_DISABLED',
      subject: 'User',
      subjectId: userId,
    });
  }

  // ── Admin Reset ────────────────────────────────────────────────────────────
  async adminResetTwoFa(targetUserId: string, adminUserId: string): Promise<{ success: boolean }> {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new BadRequestException('User không tồn tại');

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        totpSecret: null,
        totpEnabled: false,
        totpSetupPending: false,
        totpSetupPendingAt: null,
        backupCodes: [],
        backupCodeSalts: [],
        lastTotpCode: null,
        twoFaSetupAt: null,
      },
    });

    await this.audit.log({
      userId: adminUserId,
      action: 'ADMIN_2FA_RESET',
      subject: 'User',
      subjectId: targetUserId,
      metadata: { targetUserId },
    });

    return { success: true };
  }

  // ── Token Generation (mirrors AuthService private helper) ──────────────────
  private async generateTokenPair(user: {
    id: string;
    email: string;
    tokenVersion: number;
    role: { name: string };
    refreshTokenHash?: string | null;
  }): Promise<TokenPair> {
    const accessExpiry = this.config.get<string>('JWT_ACCESS_TOKEN_EXPIRES_IN', '15m');
    const refreshExpiry = this.config.get<string>('JWT_REFRESH_TOKEN_EXPIRES_IN', '7d');

    const payload = { sub: user.id, email: user.email, role: user.role.name, tokenVersion: user.tokenVersion };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as object, {
        algorithm: 'RS256',
        privateKey: this.privateKey,
        expiresIn: accessExpiry as any,
      }),
      this.jwtService.signAsync({ ...payload, type: 'refresh' } as object, {
        algorithm: 'RS256',
        privateKey: this.privateKey,
        expiresIn: refreshExpiry as any,
      }),
    ]);

    const refreshHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: refreshHash },
    });

    return { accessToken, refreshToken, expiresIn: accessExpiry };
  }
}
