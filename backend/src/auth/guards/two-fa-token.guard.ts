import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export interface TwoFaPayload {
  sub: string;
  type: string;
  jti: string;
  iat: number;
  exp: number;
  // Codex review round 2 #B: bind to user.tokenVersion at issue time. If admin
  // resets the password (which bumps tokenVersion) during the 5-min 2FA TTL,
  // the in-flight twoFaToken is rejected here — otherwise an attacker with
  // the OLD password could slip past the reset by completing 2FA on the old
  // session and then go through the forced-change flow without knowing the
  // admin's new temp password.
  tokenVersion?: number;
}

@Injectable()
export class TwoFaTokenGuard implements CanActivate {
  private readonly publicKey: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const publicKeyPath = this.config.get<string>(
      'JWT_PUBLIC_KEY_PATH',
      './keys/public.pem',
    );
    this.publicKey = fs.readFileSync(path.resolve(publicKeyPath), 'utf-8');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('twoFaToken required');
    }
    const token = authHeader.slice(7);

    let payload: TwoFaPayload;
    try {
      payload = this.jwtService.verify<TwoFaPayload>(token, {
        algorithms: ['RS256'],
        publicKey: this.publicKey,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired twoFaToken');
    }

    // OV-001: strict type check — access tokens and refresh tokens are rejected
    if (payload.type !== '2fa_pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    // OV-001: jti is required for single-use enforcement
    if (!payload.jti) {
      throw new UnauthorizedException('Missing jti claim');
    }

    // OV-002: DB-persisted single-use check — survives process restarts (Render redeploys)
    // twoFaUsedAt records when the last twoFaToken was consumed.
    // If twoFaUsedAt > token.iat, this token (or an earlier one from the same session) was already used.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, twoFaUsedAt: true, tokenVersion: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    if (user.twoFaUsedAt && user.twoFaUsedAt.getTime() > payload.iat * 1000) {
      throw new UnauthorizedException('twoFaToken already used');
    }
    // Codex review round 2 #B: tokenVersion guard. Admin password reset
    // (or any tokenVersion bump) must invalidate in-flight twoFaTokens.
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException(
        'twoFaToken invalidated by admin reset — please log in again',
      );
    }

    // OV-003: set req.user so UserThrottlerGuard.getTracker() resolves to userId, not IP
    (req as any)['user'] = { id: payload.sub };
    (req as any)['twoFaUserId'] = payload.sub;
    (req as any)['twoFaJti'] = payload.jti;
    (req as any)['twoFaIat'] = payload.iat;

    return true;
  }
}
