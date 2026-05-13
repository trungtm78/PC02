import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, Length, MinLength, Matches } from 'class-validator';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FirstLoginChangePasswordDto } from './dto/first-login-change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { ChangePasswordPendingGuard } from './guards/change-password-pending.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './interfaces/auth-user.interface';

class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  otp: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu phải có ít nhất 1 chữ hoa và 1 chữ số',
  })
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 15 } })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshToken(dto.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user.id);
  }

  // D1: forced first-login password change. ChangePasswordPendingGuard
  // validates the change_password_pending JWT and enforces state-derived
  // single-use (mustChangePassword=true required). UserThrottlerGuard then
  // rate-limits per-user (5/min). Returns a real TokenPair on success —
  // user is fully logged in, no extra dance required.
  @Post('first-login-change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(ChangePasswordPendingGuard, UserThrottlerGuard)
  async firstLoginChangePassword(
    @Body() dto: FirstLoginChangePasswordDto,
    @CurrentUser() user: AuthUser & { tokenVersion?: number },
    @Req() req: Request,
  ) {
    // Codex review round 2 #A: pass the JWT payload's tokenVersion through
    // so the service's optimistic lock uses the token-bound value, not a
    // freshly loaded one that may have been bumped by a concurrent admin
    // re-reset.
    return this.authService.firstLoginChangePassword(
      user.id,
      user.tokenVersion ?? 0,
      dto,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return { message: 'Nếu email tồn tại, bạn sẽ nhận được mã xác nhận' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })  // 3/min — same as forgot-password, higher security
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.email, dto.otp, dto.newPassword);
    return { message: 'Đặt lại mật khẩu thành công' };
  }
}
