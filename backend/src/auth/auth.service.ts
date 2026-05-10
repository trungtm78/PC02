import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { OtpCodeService } from './services/otp-code.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { TOKEN_TYPE } from '../common/constants/token-types.constants';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// ISSUE-004: login() now returns either a full TokenPair or a 2FA pending response
export type TwoFaPendingResponse = { pending: true; twoFaToken: string };
export type LoginResponse = TokenPair | TwoFaPendingResponse;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly privateKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly settingsService: SettingsService,
    private readonly otpCodeService: OtpCodeService,
    private readonly emailService: EmailService,
  ) {
    const privateKeyPath = this.configService.get<string>(
      'JWT_PRIVATE_KEY_PATH',
      './keys/private.pem',
    );
    this.privateKey = fs.readFileSync(path.resolve(privateKeyPath), 'utf-8');
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(
    dto: LoginDto,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.username },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      // Log failed attempt (no userId since unverified)
      await this.auditService.log({
        action: 'USER_LOGIN_FAILED',
        metadata: { email: dto.username },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2FA check — if enabled, return pending token instead of full TokenPair
    const is2FAEnabled = (await this.settingsService.getValue(SETTINGS_KEY.TWO_FA_ENABLED)) === 'true';
    if (is2FAEnabled) {
      const jti = crypto.randomUUID();
      const twoFaToken = await this.jwtService.signAsync(
        { sub: user.id, type: TOKEN_TYPE.TWO_FA_PENDING, jti } as object,
        { algorithm: 'RS256', privateKey: this.privateKey, expiresIn: '5m' as StringValue },
      );
      await this.auditService.log({
        userId: user.id,
        action: 'USER_LOGIN_2FA_PENDING',
        subject: 'User',
        subjectId: user.id,
        metadata: { email: user.email },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return { pending: true, twoFaToken };
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role.name,
      user.tokenVersion,
      user.canDispatch,
    );

    // Store hashed refresh token for rotation
    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: refreshHash, lastLoginAt: new Date() },
    });

    // AC-STEP1-04: Audit log (USER_LOGIN only fires here when 2FA is off)
    await this.auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      subject: 'User',
      subjectId: user.id,
      metadata: { email: user.email, role: user.role.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return tokens;
  }

  // ── Refresh Token ──────────────────────────────────────────────────────────
  async refreshToken(
    refreshToken: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenPair> {
    let payload: JwtPayload;

    try {
      const publicKeyPath = this.configService.get<string>(
        'JWT_PUBLIC_KEY_PATH',
        './keys/public.pem',
      );
      const publicKey = fs.readFileSync(path.resolve(publicKeyPath), 'utf-8');
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        algorithms: ['RS256'],
        publicKey,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Token revoked or user inactive');
    }

    const tokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );
    if (!tokenValid) {
      // Possible token reuse - revoke all tokens (security measure)
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role.name,
      user.tokenVersion,
      user.canDispatch,
    );

    // Rotate: store new refresh token hash
    const newRefreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: newRefreshHash },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'TOKEN_REFRESHED',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return tokens;
  }

  // ── Change Password ────────────────────────────────────────────────────────
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị vô hiệu hóa');
    }

    // Guard: accounts without local password (OAuth/SSO) have no hash to compare
    if (!user.passwordHash) {
      throw new BadRequestException('Tài khoản này không sử dụng đăng nhập bằng mật khẩu');
    }

    const currentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    // Use bcrypt.compare (not string equality) to handle bcrypt's 72-byte truncation
    const sameAsOld = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (sameAsOld) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);

    // Wrap DB write + audit in a single transaction: if audit fails, password change rolls back
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHash, refreshTokenHash: null, tokenVersion: { increment: 1 } },
      });
      await this.auditService.log({
        userId,
        action: 'PASSWORD_CHANGED',
        subject: 'User',
        subjectId: userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      }, tx);
    });

    return { success: true, message: 'Mật khẩu đã được cập nhật thành công' };
  }

  // ── Forgot Password ────────────────────────────────────────────────────────
  async forgotPassword(email: string): Promise<void> {
    // Silent if user not found — do NOT throw NotFoundException
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      // Return silently — don't leak whether email exists
      return;
    }
    const code = await this.otpCodeService.generate(user.id, 'PASSWORD_RESET');
    try {
      await this.emailService.sendPasswordResetEmail(email, code);
    } catch (err) {
      this.logger.error('Password reset email failed', err);
      // Still return success to user — don't reveal SMTP issues
    }
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const GENERIC_ERROR = 'Mã xác nhận không hợp lệ hoặc đã hết hạn';

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException(GENERIC_ERROR); // same error as wrong OTP — no enum leak
    }

    const valid = await this.otpCodeService.verify(user.id, otp, 'PASSWORD_RESET');
    if (!valid) {
      throw new BadRequestException(GENERIC_ERROR);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 }, // invalidate all existing JWTs (web + mobile)
        refreshTokenHash: null,          // invalidate refresh tokens
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET',
      subject: 'User',
      subjectId: user.id,
    });
  }

  // ── Profile ────────────────────────────────────────────────────────────────
  /**
   * Returns the authenticated user's profile + team membership.
   * Used by FE to pre-fill "create" forms (current user, primary team).
   * Profile is fetched fresh on login + on first boot if missing — never stored in JWT.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        userTeams: {
          include: { team: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const teams = user.userTeams.map((ut) => ({
      teamId: ut.teamId,
      teamName: ut.team.name,
      isLeader: ut.isLeader,
    }));

    // primaryTeam: leader-team first, else oldest-joined team, else null
    const leaderTeam = teams.find((t) => t.isLeader);
    const primaryTeam = leaderTeam
      ? { teamId: leaderTeam.teamId, teamName: leaderTeam.teamName }
      : teams.length > 0
      ? { teamId: teams[0].teamId, teamName: teams[0].teamName }
      : null;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      canDispatch: user.canDispatch,
      teams,
      primaryTeam,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    tokenVersion: number,
    canDispatch = false,
  ): Promise<TokenPair> {
    const accessExpiry = this.configService.get<string>(
      'JWT_ACCESS_TOKEN_EXPIRES_IN',
      '15m',
    );
    const refreshExpiry = this.configService.get<string>(
      'JWT_REFRESH_TOKEN_EXPIRES_IN',
      '7d',
    );

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      role,
      tokenVersion,
      canDispatch,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as object, {
        algorithm: 'RS256',
        privateKey: this.privateKey,
        expiresIn: accessExpiry as StringValue,
      }),
      this.jwtService.signAsync({ ...payload, type: TOKEN_TYPE.REFRESH } as object, {
        algorithm: 'RS256',
        privateKey: this.privateKey,
        expiresIn: refreshExpiry as StringValue,
      }),
    ]);

    return { accessToken, refreshToken, expiresIn: accessExpiry };
  }
}
