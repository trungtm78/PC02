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
import { TOKEN_TYPE } from '../../common/constants/token-types.constants';

interface ChangePasswordPendingPayload {
  sub: string;
  type: string;
  jti: string;
  iat: number;
  exp: number;
  // Codex challenge #2: bind the token to the user's tokenVersion at issue
  // time. If admin re-resets the user (which bumps tokenVersion), the older
  // token's tokenVersion no longer matches and the guard rejects it. Treats
  // missing/legacy values as 0 to match JwtStrategy's backward-compat rule.
  tokenVersion?: number;
}

/**
 * Guards POST /auth/first-login-change-password.
 *
 * Validates a `change_password_pending` JWT and enforces state-derived
 * single-use: once `user.mustChangePassword=false` (after a successful
 * change), the token cannot be replayed even if the JWT exp is still in
 * the future. No additional `passwordChangePendingUsedAt` column needed
 * (per H1 design choice — simpler than the 2FA `twoFaUsedAt` pattern,
 * because mustChangePassword IS the state).
 *
 * The C1 fix ensures this token cannot be used as a regular access token
 * by any other endpoint (JwtStrategy rejects all non-access typed tokens).
 */
@Injectable()
export class ChangePasswordPendingGuard implements CanActivate {
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
      throw new UnauthorizedException('changePasswordToken required');
    }
    const token = authHeader.slice(7);

    let payload: ChangePasswordPendingPayload;
    try {
      payload = this.jwtService.verify<ChangePasswordPendingPayload>(token, {
        algorithms: ['RS256'],
        publicKey: this.publicKey,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired changePasswordToken');
    }

    if (payload.type !== TOKEN_TYPE.CHANGE_PASSWORD_PENDING) {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        isActive: true,
        mustChangePassword: true,
        tokenVersion: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // H1: state-derived single-use. Once the user completes the forced change
    // (mustChangePassword cleared in the same transaction), this token is
    // rejected even if the JWT exp is still valid.
    if (!user.mustChangePassword) {
      throw new UnauthorizedException(
        'Forced password change no longer required (already completed)',
      );
    }

    // Codex #2 fix: reject tokens superseded by a newer pending-token issue.
    // E.g. admin reset T1 → user has tokenVersion=N; admin re-reset T2 →
    // tokenVersion=N+1. T1's payload.tokenVersion=N is stale → reject.
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException(
        'Token superseded by a newer reset — please use the latest temp password',
      );
    }

    // Set req.user so UserThrottlerGuard tracks per-user, not per-IP.
    // Codex review round 2 #A: also carry the PAYLOAD's tokenVersion forward
    // so the service can use it in the optimistic-lock WHERE clause. Without
    // this, a concurrent admin re-reset between guard.canActivate() and
    // service.firstLoginChangePassword() would have the service read a
    // fresher user.tokenVersion and the stale T1 update would still succeed.
    (req as any)['user'] = {
      id: payload.sub,
      tokenVersion: payload.tokenVersion ?? 0,
    };
    return true;
  }
}
