import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { TwoFaService } from './services/two-fa.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TwoFaTokenGuard } from './guards/two-fa-token.guard';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { VerifyTwoFaDto } from './dto/verify-2fa.dto';
import { VerifySetupDto } from './dto/verify-setup.dto';
import type { AuthUser } from './interfaces/auth-user.interface';

@Controller('auth/2fa')
export class TwoFaController {
  constructor(private readonly twoFaService: TwoFaService) {}

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  setup(@CurrentUser() user: AuthUser) {
    return this.twoFaService.setupTotp(user.id);
  }

  @Post('verify-setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  verifySetup(@CurrentUser() user: AuthUser, @Body() dto: VerifySetupDto) {
    return this.twoFaService.verifySetup(user.id, dto.token);
  }

  @Delete('disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  disable(@CurrentUser() user: AuthUser) {
    return this.twoFaService.disableTotp(user.id);
  }

  @Post('send-email-otp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TwoFaTokenGuard, UserThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  sendEmailOtp(@Req() req: Request) {
    const userId = (req as any)['twoFaUserId'] as string;
    return this.twoFaService.sendEmailOtp(userId);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TwoFaTokenGuard, UserThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  verify(@Req() req: Request, @Body() dto: VerifyTwoFaDto) {
    const userId = (req as any)['twoFaUserId'] as string;
    return this.twoFaService.verify(userId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
