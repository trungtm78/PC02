import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length, MinLength, Matches } from 'class-validator';
import type { Request } from 'express';
import { EnrollmentService } from './services/enrollment.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from './decorators/permissions.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './interfaces/auth-user.interface';

class ConsumeEnrollmentDto {
  @IsString()
  @Length(1, 200)
  uid: string;

  @IsString()
  @Length(1, 200)
  token: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/, {
    message: 'Mật khẩu phải có chữ hoa, chữ số và ký tự đặc biệt (!@#$%^&*).',
  })
  newPassword: string;
}

@Controller('auth')
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  // Public — user click magic link → POST với uid+token+newPassword.
  // Rate limit 5/min để chặn brute-force (token là 256-bit random, không thể
  // brute-force trong vũ trụ, nhưng vẫn limit cho DoS protection).
  @Post('enroll')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async consume(@Body() dto: ConsumeEnrollmentDto, @Req() req: Request) {
    return this.enrollmentService.consumeEnrollmentToken(
      dto.uid,
      dto.token,
      dto.newPassword,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }
}

@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminEnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  // Admin regen link cho user mất link / link expired. Audit trail trong
  // EnrollmentTokenAudit (generatedBy) + audit log (ENROLLMENT_TOKEN_GENERATED).
  @Post(':id/regenerate-enrollment-link')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'User' })
  async regenerate(
    @Param('id') userId: string,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.enrollmentService.generateEnrollmentLink(userId, admin.id);
  }
}
