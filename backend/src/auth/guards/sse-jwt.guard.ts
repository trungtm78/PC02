import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';
import type { Request } from 'express';

@Injectable()
export class SseJwtGuard implements CanActivate {
  private readonly publicKey: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    const keyPath = config.get<string>('JWT_PUBLIC_KEY_PATH', './keys/public.pem');
    this.publicKey = fs.readFileSync(path.resolve(keyPath), 'utf-8');
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = req.query['token'] as string | undefined;
    if (!token) throw new UnauthorizedException();
    try {
      req['user'] = this.jwt.verify(token, {
        publicKey: this.publicKey,
        algorithms: ['RS256'],
      });
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
