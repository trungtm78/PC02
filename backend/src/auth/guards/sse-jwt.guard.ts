import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';
import type { Request } from 'express';
import { TOKEN_TYPE } from '../../common/constants/token-types.constants';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SseJwtGuard implements CanActivate {
  private readonly publicKey: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const keyPath = config.get<string>('JWT_PUBLIC_KEY_PATH', './keys/public.pem');
    this.publicKey = fs.readFileSync(path.resolve(keyPath), 'utf-8');
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = req.query['token'] as string | undefined;
    if (!token) throw new UnauthorizedException();

    let payload: any;
    try {
      payload = this.jwt.verify(token, {
        publicKey: this.publicKey,
        algorithms: ['RS256'],
      });
    } catch {
      throw new UnauthorizedException();
    }

    // Token truy cập THẬT không mang trường `type`: máy chủ ký `payload` trần
    // (`auth.service.ts`), chỉ token LÀM MỚI mới được gắn `type: 'refresh'`. Đòi
    // `type === 'access'` là từ chối mọi token thật — dòng thông báo trực tuyến chưa từng chạy
    // trên máy thật (đo 09/09/2026: `/notifications` trả 200 còn `/notifications/stream` trả
    // 401 với CÙNG một token).
    //
    // Luật ở đây phải TRÙNG với `jwt.strategy.ts`: từ chối token làm mới và mọi token có `type`
    // khác `access`; token không khai `type` là token truy cập.
    if (payload.type === TOKEN_TYPE.REFRESH) throw new UnauthorizedException();
    if (payload.type && payload.type !== TOKEN_TYPE.ACCESS) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) throw new UnauthorizedException();

    req['user'] = payload;
    return true;
  }
}
