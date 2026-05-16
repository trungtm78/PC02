import { Injectable, UnauthorizedException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
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
import {
  MAX_FAILED_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from '../common/constants/auth-policy.constants';
import { getBcryptCost } from './utils/password-hash.util';
import { classifyIdentifier } from './utils/identifier-classifier';
import { MetricsService } from '../metrics/metrics.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// ISSUE-004: login() now returns either a full TokenPair or a 2FA pending response
export type TwoFaPendingResponse = { pending: true; twoFaToken: string };
// Sprint 2 / S2.4 — login khi user chưa setup 2FA + bắt buộc setup.
// Frontend redirect /auth/2fa-setup. Token scope tới initial-setup endpoints.
export type TwoFaSetupPendingResponse = {
  pending: true;
  twoFaSetupToken: string;
  reason: 'TWO_FA_SETUP_REQUIRED';
};
// C2 / D1: when admin reset or first-login forces a password change, login()
// (or 2FA verify, post-OTP) returns this pending response. The frontend
// redirects to /auth/first-login-change-password and exchanges the token
// for a new password. The token is single-use via the state-derived check
// (`user.mustChangePassword=false` after the change clears the flag).
export type ChangePasswordPendingResponse = {
  pending: true;
  changePasswordToken: string;
  reason: 'MUST_CHANGE_PASSWORD';
};
export type LoginResponse =
  | TokenPair
  | TwoFaPendingResponse
  | TwoFaSetupPendingResponse
  | ChangePasswordPendingResponse;

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
    private readonly metrics: MetricsService,
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
    // Multi-field login (post-/autoplan): classify identifier shape → query đúng
    // field cụ thể. KHÔNG dùng findFirst+OR (collision DoS attack — User A
    // workId='0934314279' + User B phone='0934314279' → OR trả random).
    // Phone field KHÔNG @unique (vợ chồng share), nên dùng findFirst với
    // orderBy deterministic. Email/workId/username @unique → findUnique safe.
    const { field, value } = classifyIdentifier(dto.username);
    const user = field === 'phone'
      ? await this.prisma.user.findFirst({
          where: { phone: value },
          orderBy: { id: 'asc' },
          include: { role: true },
        })
      : await this.prisma.user.findUnique({
          where: { [field]: value } as any,
          include: { role: true },
        });

    if (!user || !user.isActive) {
      this.metrics.loginAttempts.inc({ result: 'failure' });
      throw new UnauthorizedException('Invalid credentials');
    }

    // S1.2 account lockout — reject early nếu đang lock.
    // Skip bcrypt.compare để không leak timing info phân biệt locked vs wrong-pw.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      this.metrics.loginAttempts.inc({ result: 'locked' });
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      throw new UnauthorizedException(
        `Tài khoản đã bị khoá tạm thời. Thử lại sau ${remainingMinutes} phút.`,
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      // S1.2: increment counter, lock nếu đạt threshold.
      const newAttempts = user.failedLoginAttempts + 1;
      const willLock = newAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
      const now = new Date();
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lastFailedLoginAt: now,
          lockedUntil: willLock ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : user.lockedUntil,
        },
      });

      this.metrics.loginAttempts.inc({ result: willLock ? 'locked' : 'failure' });
      await this.auditService.log({
        userId: user.id,
        action: willLock ? 'USER_LOGIN_LOCKED' : 'USER_LOGIN_FAILED',
        metadata: { email: dto.username, attempts: newAttempts },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2FA check — if enabled, return pending token instead of full TokenPair
    const is2FAEnabled = (await this.settingsService.getValue(SETTINGS_KEY.TWO_FA_ENABLED)) === 'true';

    // Sprint 2 / S2.4 — setup mandate: nếu user chưa enable totp nhưng 2FA
    // bắt buộc (system-wide OR per-user flag), return setup-pending response để
    // frontend redirect tới /auth/2fa-setup. KHÔNG bypass — login chưa hoàn tất.
    const needsSetup =
      !user.totpEnabled &&
      (is2FAEnabled || (user as { twoFaSetupRequired?: boolean }).twoFaSetupRequired === true);
    if (needsSetup) {
      const setupJti = crypto.randomUUID();
      const twoFaSetupToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          type: TOKEN_TYPE.TWO_FA_SETUP_PENDING,
          jti: setupJti,
          tokenVersion: user.tokenVersion,
        } as object,
        { algorithm: 'RS256', privateKey: this.privateKey, expiresIn: '15m' as StringValue },
      );
      this.metrics.loginAttempts.inc({ result: '2fa_setup_required' });
      await this.auditService.log({
        userId: user.id,
        action: 'USER_2FA_SETUP_REQUIRED',
        subject: 'User',
        subjectId: user.id,
        metadata: { email: user.email },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return {
        pending: true,
        twoFaSetupToken,
        reason: 'TWO_FA_SETUP_REQUIRED',
      };
    }

    if (is2FAEnabled) {
      const jti = crypto.randomUUID();
      // Codex review round 2 #B: bind tokenVersion to twoFaToken so admin
      // password reset (which bumps tokenVersion) invalidates in-flight 2FA
      // tokens. Without this, an attacker with the old password could complete
      // 2FA after a reset and slip into the forced-change flow.
      const twoFaToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          type: TOKEN_TYPE.TWO_FA_PENDING,
          jti,
          tokenVersion: user.tokenVersion,
        } as object,
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

    // C2 / D1: when 2FA is disabled, check mustChangePassword here. When 2FA
    // is enabled, the same check runs again inside TwoFaService.verify after
    // OTP success — both paths gate the real TokenPair behind the forced
    // password change.
    if (user.mustChangePassword) {
      return this.issueChangePasswordPending(
        user.id,
        user.email ?? user.username,
        user.tokenVersion,
        meta,
      );
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email ?? user.username,
      user.role.name,
      user.tokenVersion,
      user.canDispatch,
    );

    // Store hashed refresh token for rotation + reset lockout state (S1.2)
    const refreshHash = await bcrypt.hash(tokens.refreshToken, getBcryptCost());
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: refreshHash,
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
      },
    });

    this.metrics.loginAttempts.inc({ result: 'success' });
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

  // ── Sprint 2 / S2.3 — Backend logout ──────────────────────────────────────
  //
  // Clear refreshTokenHash để refresh token cũ không refresh được nữa. Server-side
  // revocation — khắc phục gap "frontend chỉ clear localStorage" pre-S2.3.
  async logout(
    userId: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ success: true }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    await this.auditService.log({
      userId,
      action: 'USER_LOGOUT',
      subject: 'User',
      subjectId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { success: true };
  }

  // ── Change-password pending response (D1 / C2 helper) ─────────────────────
  // Issues a short-lived JWT (`change_password_pending`) scoped solely to
  // POST /auth/first-login-change-password. The guard rejects it for any
  // other endpoint (defense-in-depth on top of the C1 JwtStrategy fix).
  // F3 audit: every blocked login emits USER_LOGIN_BLOCKED_PENDING_PASSWORD_CHANGE.
  async issueChangePasswordPending(
    userId: string,
    email: string,
    tokenVersion: number,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<ChangePasswordPendingResponse> {
    const jti = crypto.randomUUID();
    // Codex #2: bind to tokenVersion so a re-reset (which bumps tokenVersion)
    // immediately invalidates this older token in ChangePasswordPendingGuard.
    const changePasswordToken = await this.jwtService.signAsync(
      {
        sub: userId,
        type: TOKEN_TYPE.CHANGE_PASSWORD_PENDING,
        jti,
        tokenVersion,
      } as object,
      {
        algorithm: 'RS256',
        privateKey: this.privateKey,
        expiresIn: '15m' as StringValue,
      },
    );
    await this.auditService.log({
      userId,
      action: 'USER_LOGIN_BLOCKED_PENDING_PASSWORD_CHANGE',
      subject: 'User',
      subjectId: userId,
      metadata: { email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return {
      pending: true,
      changePasswordToken,
      reason: 'MUST_CHANGE_PASSWORD',
    };
  }

  // ── First-login forced password change (D1) ───────────────────────────────
  // Called from POST /auth/first-login-change-password (gated by
  // ChangePasswordPendingGuard). User exchanges the change_password_pending
  // token + new password for a real TokenPair (full login completes here).
  //
  // `expectedTokenVersion` MUST come from the JWT payload (set by the guard
  // on req.user). Using the freshly-loaded user.tokenVersion here is racy:
  // a concurrent admin re-reset between guard and this call would silently
  // accept the stale token (Codex review round 2 #A).
  async firstLoginChangePassword(
    userId: string,
    expectedTokenVersion: number,
    dto: { newPassword: string },
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa',
      );
    }
    if (!user.mustChangePassword) {
      // The guard already rejects this case; this is defense-in-depth in case
      // the guard is bypassed (e.g. internal call from another service).
      throw new BadRequestException('Không cần đổi mật khẩu lần đầu');
    }
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Tài khoản này không sử dụng đăng nhập bằng mật khẩu',
      );
    }

    // Reject "change to the temp password I just received" (it's the same hash).
    const sameAsTemp = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (sameAsTemp) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng mật khẩu tạm thời',
      );
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);

    // H2 + Codex #3 + Codex review round 2 #A: update + audit transactional,
    // with optimistic lock on tokenVersion. The WHERE constraint uses the
    // version FROM THE JWT PAYLOAD (passed in by the guard) so a concurrent
    // admin re-reset that bumped the DB version between guard and this call
    // correctly fails this update with count=0.
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: userId, tokenVersion: expectedTokenVersion },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          tokenVersion: { increment: 1 },
          refreshTokenHash: null,
          lastLoginAt: new Date(),
        },
      });
      if (result.count === 0) {
        throw new ConflictException(
          'Mật khẩu đã được đổi bởi yêu cầu khác hoặc admin vừa reset lại — vui lòng đăng nhập lại',
        );
      }
      await this.auditService.log(
        {
          userId,
          action: 'FIRST_LOGIN_PASSWORD_CHANGED',
          subject: 'User',
          subjectId: userId,
          metadata: { email: user.email },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        tx,
      );
      // Codex review round 2 #C: the forced-change flow IS a completed
      // login (TokenPair issued, lastLoginAt set). Emit USER_LOGIN so
      // audit queries keyed on USER_LOGIN see this as a completed session,
      // consistent with the normal login and post-2FA paths.
      await this.auditService.log(
        {
          userId,
          action: 'USER_LOGIN',
          subject: 'User',
          subjectId: userId,
          metadata: {
            email: user.email,
            role: user.role.name,
            viaForcedChange: true,
          },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });

    // Issue a fresh TokenPair with the new tokenVersion (post-increment).
    // We use expectedTokenVersion+1 because the update was bound to that value.
    const tokens = await this.generateTokens(
      user.id,
      user.email ?? user.username,
      user.role.name,
      expectedTokenVersion + 1,
      user.canDispatch,
    );

    // Codex challenge #1 fix: persist the refresh token hash so /auth/refresh
    // works after the access token expires. Without this update, the user
    // appears logged in but is silently logged out 15 min later because
    // refreshToken() requires a stored hash to compare against.
    const refreshHash = await bcrypt.hash(tokens.refreshToken, getBcryptCost());
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: refreshHash },
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

    // Codex challenge #4 fix: enforce tokenVersion on refresh path. Without
    // this, the deploy migration that bumps every user's tokenVersion (to
    // invalidate the C1 pre-existing pending-token bug) does NOT actually
    // log refresh-token holders out — they just mint fresh tokens at the
    // current version. Legacy tokens (no tokenVersion in payload) are
    // treated as version 0, matching JwtStrategy behavior.
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException(
        'Refresh token invalidated — please log in again',
      );
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
      user.email ?? user.username,
      user.role.name,
      user.tokenVersion,
      user.canDispatch,
    );

    // Rotate: store new refresh token hash
    const newRefreshHash = await bcrypt.hash(tokens.refreshToken, getBcryptCost());
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
        // H5: self-reset legitimately satisfies the "user owns their own
        // password" invariant. If admin had previously set mustChangePassword=true
        // and the user goes through forgot-password instead of the forced flow,
        // we must clear the flag — otherwise login() blocks them with a temp
        // password they no longer have.
        mustChangePassword: false,
        passwordChangedAt: new Date(),
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
  // Public — used bởi EnrollmentService.consumeEnrollmentToken (post-/autoplan)
  // sau khi user set password mới qua magic link.
  async generateTokens(
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
