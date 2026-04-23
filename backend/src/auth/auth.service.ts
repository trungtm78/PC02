import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

@Injectable()
export class AuthService {
  private readonly privateKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
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
  ): Promise<TokenPair> {
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

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role.name,
    );

    // Store hashed refresh token for rotation
    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: refreshHash, lastLoginAt: new Date() },
    });

    // AC-STEP1-04: Audit log
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
        data: { passwordHash: newHash, refreshTokenHash: null },
      });
      await this.auditService.log({
        userId,
        action: 'PASSWORD_CHANGED',
        subject: 'User',
        subjectId: userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    });

    return { success: true, message: 'Mật khẩu đã được cập nhật thành công' };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
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
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as object, {
        algorithm: 'RS256',
        privateKey: this.privateKey,
        expiresIn: accessExpiry as StringValue,
      }),
      this.jwtService.signAsync({ ...payload, type: 'refresh' } as object, {
        algorithm: 'RS256',
        privateKey: this.privateKey,
        expiresIn: refreshExpiry as StringValue,
      }),
    ]);

    return { accessToken, refreshToken, expiresIn: accessExpiry };
  }
}
