import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: string;
  tokenVersion?: number; // absent in tokens issued before v0.5.4.0 — treated as 0
  type?: string; // 'refresh' for refresh tokens
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const publicKeyPath = configService.get<string>(
      'JWT_PUBLIC_KEY_PATH',
      './keys/public.pem',
    );
    const publicKey = fs.readFileSync(path.resolve(publicKeyPath), 'utf-8');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: JwtPayload) {
    // Reject refresh tokens used as access tokens
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Refresh tokens cannot be used for API access');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Tokens issued before password change carry an old tokenVersion and are rejected
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Token invalidated — please log in again');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role.name,
      roleId: user.roleId,
    };
  }
}
