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
import type { TokenPair, ChangePasswordPendingResponse } from '../auth.service';
import { TOKEN_TYPE } from '../../common/constants/token-types.constants';
import type { StringValue } from 'ms';
import { SETTINGS_KEY } from '../../common/constants/settings-keys.constants';
import { getBcryptCost } from '../utils/password-hash.util';
import {
  TWO_FA_METHOD,
  TwoFaMethod,
} from '../../common/constants/two-fa-methods.constants';

const SETUP_PENDING_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const BACKUP_CODE_COUNT = 10;
// Match the cost of real entries so bcrypt.compare against the dummy takes the
// same wall-clock time as comparing against a stored hash. Test env uses cost 4
// to keep jest under its 5s/test timeout while still exercising the dummy path.
const BCRYPT_COST = process.env.NODE_ENV === 'test' ? 4 : 12;
// Module-level dummy bcrypt hash. verifyBackup pads its loop with this hash
// so total response time stays constant regardless of how many codes the user
// has left or whether legacy sha256 entries are mixed in. Generated once at
// module load; nothing matches it because the plaintext is fixed and random.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync(
  `__pad__${crypto.randomBytes(8).toString('hex')}`,
  BCRYPT_COST,
);

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

    // Generate BACKUP_CODE_COUNT backup codes (12-char hex each). Hash with
    // bcrypt cost 12 so a DB breach can't be GPU-brute-forced. bcrypt embeds
    // its own salt; backupCodeSalts kept as parallel empty strings to preserve
    // schema parity. Hashes computed in parallel via Promise.all so setup
    // doesn't hold the libuv threadpool for ~2.5s (~250ms × 10 sequential).
    const plainCodes: string[] = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      crypto.randomBytes(6).toString('hex'),
    );
    const backupCodes: string[] = await Promise.all(
      plainCodes.map((c) => bcrypt.hash(c, BCRYPT_COST)),
    );
    const backupCodeSalts: string[] = new Array(BACKUP_CODE_COUNT).fill('');

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

    const code = await this.otpCode.generate(userId, 'TWO_FA');
    await this.email.sendTwoFaOtp(user.email, code);
  }

  // ── Verify 2FA ─────────────────────────────────────────────────────────────
  async verify(
    userId: string,
    dto: { code: string; method: TwoFaMethod },
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenPair | ChangePasswordPendingResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();

    let verified = false;

    if (dto.method === TWO_FA_METHOD.TOTP) {
      verified = await this.verifyTotp(user, dto.code, meta);
    } else if (dto.method === TWO_FA_METHOD.EMAIL_OTP) {
      verified = await this.verifyEmailOtp(userId, dto.code, meta);
    } else if (dto.method === TWO_FA_METHOD.BACKUP) {
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

    // OV-002 + Codex #7: mark twoFaToken as consumed (must run regardless to
    // prevent replay), but only set lastLoginAt when the login fully completes
    // (no forced password change pending). Otherwise lastLoginAt would imply
    // a successful session even though firstLoginChangePassword hasn't run.
    const willBeBlockedOnChangePw = !!user.mustChangePassword;
    await this.prisma.user.update({
      where: { id: userId },
      data: willBeBlockedOnChangePw
        ? { twoFaUsedAt: new Date() }
        : { twoFaUsedAt: new Date(), lastLoginAt: new Date() },
    });

    await this.audit.log({
      userId,
      action: 'USER_2FA_VERIFIED',
      subject: 'User',
      subjectId: userId,
      metadata: {
        method: dto.method,
        // Codex #7: distinguish "passed 2FA AND completed login" vs
        // "passed 2FA, blocked on forced-change" so compliance queries
        // don't count the latter as a completed session.
        ...(willBeBlockedOnChangePw && { blockedPendingChange: true }),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // C2 critical: re-check mustChangePassword AFTER 2FA succeeds. Without
    // this, a user with both 2FA enabled AND mustChangePassword=true would
    // skip the forced password change entirely (login returns twoFaToken,
    // 2FA verify returns full tokens — the change-pw gate never fires).
    if (user.mustChangePassword) {
      const jti = crypto.randomUUID();
      // Codex #2: bind to user.tokenVersion at issue time so a later admin
      // reset invalidates this token via ChangePasswordPendingGuard.
      const changePasswordToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          type: TOKEN_TYPE.CHANGE_PASSWORD_PENDING,
          jti,
          tokenVersion: user.tokenVersion,
        } as object,
        {
          algorithm: 'RS256',
          privateKey: this.privateKey,
          expiresIn: '15m' as StringValue,
        },
      );
      await this.audit.log({
        userId,
        action: 'USER_LOGIN_BLOCKED_PENDING_PASSWORD_CHANGE',
        subject: 'User',
        subjectId: userId,
        metadata: { email: user.email, postOtp: true },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return {
        pending: true,
        changePasswordToken,
        reason: 'MUST_CHANGE_PASSWORD',
      };
    }

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
    return this.otpCode.verify(userId, code, 'TWO_FA');
  }

  private async verifyBackup(
    user: { id: string; backupCodes: string[]; backupCodeSalts: string[] },
    code: string,
    _meta: { ipAddress?: string; userAgent?: string },
  ): Promise<boolean> {
    if (user.backupCodes.length === 0) return false;

    let matchIdx = -1;

    // Timing-leak defense (OV-004 + adversarial review C1):
    //   bcrypt.compare returns false on legacy 64-char hex sha256 entries
    //   in microseconds, while real bcrypt entries take ~250ms — a response-
    //   time oracle that leaks the legacy/bcrypt mix AND the remaining-code
    //   count. Pad the loop to BACKUP_CODE_COUNT compares regardless of
    //   array length, and compare a dummy hash for non-bcrypt slots so every
    //   iteration takes a real bcrypt verification's worth of time.
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const stored = i < user.backupCodes.length ? user.backupCodes[i] : undefined;
      const target = stored && stored.startsWith('$2') ? stored : DUMMY_BCRYPT_HASH;
      const isMatch = await bcrypt.compare(code, target);
      // Only accept the match if we compared against the user's real stored
      // entry — never count a successful dummy-hash compare (impossible by
      // construction, but defense in depth).
      if (isMatch && stored && target === stored) matchIdx = i;
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
    const is2FAEnabled = await this.settings.getValue(SETTINGS_KEY.TWO_FA_ENABLED) === 'true';
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

  // ── Sprint 2 / S2.4 — Initial Setup Flow ────────────────────────────────
  //
  // Khi login() trả `TWO_FA_SETUP_REQUIRED` + setupToken, frontend gọi 2 endpoint:
  //   1. POST /auth/initial-2fa-setup        → wrap setupTotp() trả QR + backup codes
  //   2. POST /auth/initial-2fa-setup/verify → verify first OTP, enable totp,
  //                                            clear twoFaSetupRequired, trả TokenPair
  // ──────────────────────────────────────────────────────────────────────────

  async initialSetup(userId: string): Promise<{ qrCodeDataUrl: string; backupCodes: string[] }> {
    // Reuse logic của setupTotp — không cần thêm gì khác, user state giống nhau.
    return this.setupTotp(userId);
  }

  async completeInitialSetup(
    userId: string,
    token: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenPair> {
    // 1. Verify TOTP code (same as verifySetup) — sẽ throw nếu invalid.
    await this.verifySetup(userId, token);

    // 2. Clear twoFaSetupRequired flag (user xong initial setup, lần sau login bình thường).
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaSetupRequired: false },
    });

    // 3. Audit log đặc thù cho initial-setup completion (distinguishable từ USER_2FA_SETUP
    //    của settings-page re-setup).
    await this.audit.log({
      userId,
      action: 'USER_2FA_INITIAL_SETUP_COMPLETED',
      subject: 'User',
      subjectId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // 4. Issue real TokenPair — login flow hoàn tất.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.generateTokenPair(user);
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
      this.jwtService.signAsync({ ...payload, type: TOKEN_TYPE.REFRESH } as object, {
        algorithm: 'RS256',
        privateKey: this.privateKey,
        expiresIn: refreshExpiry as any,
      }),
    ]);

    const refreshHash = await bcrypt.hash(refreshToken, getBcryptCost());
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: refreshHash },
    });

    return { accessToken, refreshToken, expiresIn: accessExpiry };
  }
}
