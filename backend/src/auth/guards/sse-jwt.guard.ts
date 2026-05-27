import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';
import type { Request } from 'express';
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

    if (payload.type !== 'access') throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) throw new UnauthorizedException();

    req['user'] = payload;
    return true;
  }
}
