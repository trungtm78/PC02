import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EditWindowService } from './edit-window.service';
import { CreateResetRequestDto } from './dto/create-reset-request.dto';
import { BulkApproveDto, RejectRequestDto } from './dto/review-reset-request.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@Controller('edit-window')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EditWindowController {
  constructor(private readonly editWindow: EditWindowService) {}

  // POST /api/v1/edit-window/requests — any authenticated user
  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ action: 'read', subject: 'Case' }) // any read perm = any user
  createRequest(
    @Body() dto: CreateResetRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.editWindow.createResetRequest(user.id, dto);
  }

  // GET /api/v1/edit-window/requests — admin/HEAD_UNIT see queue
  @Get('requests')
  @RequirePermissions({ action: 'review_reset_request', subject: 'EditWindowResetRequest' })
  list(
    @Query() query: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'; limit?: string; offset?: string; countOnly?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.editWindow.list(
      {
        status: query.status,
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
        countOnly: query.countOnly === 'true',
      },
      user,
    );
  }

  // POST /api/v1/edit-window/requests/bulk-approve
  @Post('requests/bulk-approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review_reset_request', subject: 'EditWindowResetRequest' })
  bulkApprove(
    @Body() dto: BulkApproveDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.editWindow.bulkApprove(dto.requestIds, dto.reviewNote, user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // POST /api/v1/edit-window/requests/:id/reject
  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review_reset_request', subject: 'EditWindowResetRequest' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectRequestDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.editWindow.reject(id, dto.reviewNote, user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
