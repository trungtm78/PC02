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

/**
 * Sprint 2 / S2.4 — Guard cho TWO_FA_SETUP_PENDING token type.
 *
 * Issued bởi login() khi user chưa setup 2FA + system bắt buộc. Scope tới
 * endpoints `/auth/initial-2fa-setup` + `/initial-2fa-setup/verify`. Token
 * sống 15 phút, bind to `tokenVersion` để admin reset password sẽ invalidate.
 *
 * Khác TwoFaTokenGuard ở chỗ check `type === '2fa_setup_pending'` (không phải
 * '2fa_pending'). Setup token KHÔNG single-use vì setup flow gồm 2 step
 * (setup → verify-setup); 2 lần dùng cùng token là hợp pháp.
 */
export interface TwoFaSetupPayload {
  sub: string;
  type: string;
  jti: string;
  iat: number;
  exp: number;
  tokenVersion?: number;
}

@Injectable()
export class TwoFaSetupTokenGuard implements CanActivate {
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
      throw new UnauthorizedException('twoFaSetupToken required');
    }
    const token = authHeader.slice(7);

    let payload: TwoFaSetupPayload;
    try {
      payload = this.jwtService.verify<TwoFaSetupPayload>(token, {
        algorithms: ['RS256'],
        publicKey: this.publicKey,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired twoFaSetupToken');
    }

    if (payload.type !== TOKEN_TYPE.TWO_FA_SETUP_PENDING) {
      throw new UnauthorizedException('Invalid token type');
    }
    if (!payload.jti) {
      throw new UnauthorizedException('Missing jti claim');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, tokenVersion: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    // Admin reset password (bump tokenVersion) phải invalidate in-flight setup token.
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException(
        'twoFaSetupToken invalidated by admin reset — please log in again',
      );
    }

    // Set req.user cho UserThrottlerGuard và CurrentUser decorator resolve userId
    (req as unknown as { user: { id: string } }).user = { id: payload.sub };
    (req as unknown as { twoFaSetupUserId: string }).twoFaSetupUserId = payload.sub;

    return true;
  }
}
