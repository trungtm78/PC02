import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TwoFaController } from './two-fa.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TwoFaTokenGuard } from './guards/two-fa-token.guard';
import { TwoFaSetupTokenGuard } from './guards/two-fa-setup-token.guard';
import { ChangePasswordPendingGuard } from './guards/change-password-pending.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { TwoFaService } from './services/two-fa.service';
import { TotpEncryptionService } from './services/totp-encryption.service';
import { OtpCodeService } from './services/otp-code.service';
import { EnrollmentService } from './services/enrollment.service';
import {
  EnrollmentController,
  AdminEnrollmentController,
} from './enrollment.controller';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JwtModule registered without secret - each sign uses explicit privateKey
    JwtModule.register({ signOptions: { algorithm: 'RS256' } }),
    ConfigModule,
    AuditModule,
    SettingsModule,  // ISSUE-003: required for TWO_FA_ENABLED check in login()
    EmailModule,     // required for Email OTP
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    TwoFaTokenGuard,
    TwoFaSetupTokenGuard,
    ChangePasswordPendingGuard,
    PermissionsGuard,
    UserThrottlerGuard,
    TwoFaService,
    TotpEncryptionService,
    OtpCodeService,
    EnrollmentService,
  ],
  controllers: [
    AuthController,
    TwoFaController,
    EnrollmentController,
    AdminEnrollmentController,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    PermissionsGuard,
    TwoFaService,
    EnrollmentService,
  ],
})
export class AuthModule {}
