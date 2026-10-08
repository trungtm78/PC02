import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CaseAccessMode } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { CasePrincipalAccessService } from './case-principal-access.service';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';
class AccessModeDto {
  @IsEnum(CaseAccessMode) caseAccessMode: CaseAccessMode;
  @IsNgayThat() expectedUserUpdatedAt: string;
  @IsInt() @Min(0) expectedCaseAccessRevision: number;
  @IsString() @IsNotEmpty() @MaxLength(200) requestKey: string;
  @IsString() @MinLength(10) @MaxLength(1000) reason: string;
}
@Controller('cases/governance/principals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasePrincipalAccessController {
  constructor(private readonly access: CasePrincipalAccessService) {}
  @Get(':userId/access-mode')
  @RequirePermissions(
    { subject: 'CaseGovernance', action: 'manage_access' },
    { subject: 'User', action: 'write' },
  )
  get(@Param('userId') userId: string, @CurrentUser() user: AuthUser) {
    return this.access.get(userId, { actorId: user.id });
  }
  @Post(':userId/access-mode')
  @RequirePermissions(
    { subject: 'CaseGovernance', action: 'manage_access' },
    { subject: 'User', action: 'write' },
  )
  change(
    @Param('userId') userId: string,
    @Body() dto: AccessModeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.access.change(userId, dto, { actorId: user.id });
  }
}
