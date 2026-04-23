import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JwtModule registered without secret - each sign uses explicit privateKey
    JwtModule.register({ signOptions: { algorithm: 'RS256' } }),
    ConfigModule,
    AuditModule,
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, PermissionsGuard, UserThrottlerGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
