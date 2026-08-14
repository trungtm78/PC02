import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { DispatchGuard } from '../auth/guards/dispatch.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { RecordReturnsService } from './record-returns.service';
import {
  CreateRecordReturnDto,
  RevertRecordReturnDto,
  type ReturnTarget,
} from './dto/create-record-return.dto';
import type { RecordReturnType } from '@prisma/client';

/**
 * Trả hồ sơ về đơn vị đã chuyển đến.
 *
 * `DispatchGuard` trên đường ghi: trả hồ sơ là quyết định điều phối giữa các
 * đơn vị, không phải thao tác nghiệp vụ của người thụ lý.
 */
@Controller('workflow/returns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecordReturnsController {
  constructor(private readonly service: RecordReturnsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(DispatchGuard)
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  create(
    @Body() dto: CreateRecordReturnDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.service.createMany(dto, user.id, req.dataScope, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/revert')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DispatchGuard)
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  revert(
    @Param('id') id: string,
    @Body() dto: RevertRecordReturnDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.service.revert(id, dto, user.id, req.dataScope, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  list(
    @Query()
    query: {
      target?: ReturnTarget;
      returnType?: RecordReturnType;
      includeReverted?: string;
      limit?: number;
      offset?: number;
    },
    @Req() req: ScopedRequest,
  ) {
    return this.service.list(query, req.dataScope);
  }
}
