import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { DocumentNumbersService } from './document-numbers.service';
import { DraftNumberDto, CommitNumberDto } from './dto/draft-commit.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

@Controller('document-numbers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentNumbersController {
  constructor(private readonly service: DocumentNumbersService) {}

  // ─── Internal: draft / commit (dùng bởi business forms) ─────────

  @Post('draft')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async draft(@Body() dto: DraftNumberDto, @CurrentUser() user: AuthUser) {
    const ctx = await this.service.buildCtx(user.id);
    return this.service.draft(dto.documentType, ctx);
  }

  @Post('commit')
  @RequirePermissions({ action: 'write', subject: 'Case' })
  async commit(@Body() dto: CommitNumberDto, @CurrentUser() user: AuthUser) {
    const ctx = await this.service.buildCtx(user.id);
    return this.service.commit(dto.documentType, ctx, {
      documentId: dto.documentId,
      draftPreview: dto.draftPreview,
    });
  }

  @Patch('logs/:logId')
  @RequirePermissions({ action: 'write', subject: 'Case' })
  async updateLogDocumentId(
    @Param('logId') logId: string,
    @Body('documentId') documentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const log = await this.service.getLog(logId);
    if (!log) throw new ForbiddenException('Log entry not found');
    if (log.userId !== user.id && !ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException('Chỉ được cập nhật log của chính mình');
    }
    await this.service.updateLogDocumentId(logId, documentId);
    return { success: true };
  }

  // ─── Admin: template CRUD ──────────────────────────────────────

  @Get('templates')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getTemplates() {
    return this.service.getTemplates();
  }

  @Post('templates')
  @RequirePermissions({ action: 'write', subject: 'Case' })
  async createTemplate(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.requireAdmin(user);
    return this.service.createTemplate(dto, user.id);
  }

  @Put('templates/:id')
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.requireAdmin(user);
    return this.service.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @RequirePermissions({ action: 'delete', subject: 'Case' })
  async deleteTemplate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.requireAdmin(user);
    return this.service.deleteTemplate(id);
  }

  @Post('templates/:id/preview')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async previewTemplate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const ctx = await this.service.buildCtx(user.id);
    return this.service.preview(id, ctx);
  }

  @Get('templates/:id/stats')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async getStats(@Param('id') id: string) {
    return this.service.getStats(id);
  }

  @Post('templates/:id/reset-counter')
  @RequirePermissions({ action: 'write', subject: 'Case' })
  async resetCounter(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.requireAdmin(user);
    await this.service.resetCounter(id);
    return { success: true };
  }

  @Get('logs')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getLogs(
    @Query('templateId') templateId?: string,
    @Query('userId') userId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @CurrentUser() user?: AuthUser,
  ) {
    const scopedUserId = ADMIN_ROLES.includes(user?.role ?? '') ? userId : user?.id;
    return this.service.getLogs({
      templateId,
      userId: scopedUserId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
    });
  }

  private requireAdmin(user: AuthUser) {
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException('Chỉ Admin mới có quyền thực hiện thao tác này');
    }
  }
}
