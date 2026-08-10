import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { EvidencesService } from './evidences.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { UpdateEvidenceDto } from './dto/update-evidence.dto';
import { QueryEvidencesDto } from './dto/query-evidences.dto';
import { RestoreEvidenceDto } from './dto/restore-evidence.dto';

@Controller('evidences')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EvidencesController {
  constructor(private readonly evidencesService: EvidencesService) {}

  // GET /api/v1/evidences — danh sách vật chứng
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Evidence' })
  getList(@Query() query: QueryEvidencesDto, @Req() req: ScopedRequest) {
    return this.evidencesService.getList(query, req.dataScope);
  }

  // GET /api/v1/evidences/admin/deleted — vật chứng đã xóa mềm.
  // Declared before ':id' so the literal segment is not swallowed by the param.
  @Get('admin/deleted')
  @RequirePermissions({ action: 'restore', subject: 'Evidence' })
  listDeleted(
    @Query() query: { limit?: number; offset?: number; search?: string },
    @Req() req: ScopedRequest,
  ) {
    return this.evidencesService.listDeleted(query, req.dataScope);
  }

  // GET /api/v1/evidences/:id — chi tiết vật chứng
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Evidence' })
  getById(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.evidencesService.getById(id, req.dataScope);
  }

  // POST /api/v1/evidences — thêm vật chứng
  @Post()
  @RequirePermissions({ action: 'write', subject: 'Evidence' })
  create(
    @Body() dto: CreateEvidenceDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidencesService.create(
      dto,
      user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.dataScope,
    );
  }

  // PUT /api/v1/evidences/:id — cập nhật vật chứng
  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Evidence' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEvidenceDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidencesService.update(
      id,
      dto,
      user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.dataScope,
    );
  }

  // DELETE /api/v1/evidences/:id — xóa mềm
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Evidence' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidencesService.delete(
      id,
      user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.dataScope,
    );
  }

  // POST /api/v1/evidences/:id/restore — khôi phục
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'restore', subject: 'Evidence' })
  restore(
    @Param('id') id: string,
    @Body() dto: RestoreEvidenceDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidencesService.restore(
      id,
      dto.reason,
      user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.dataScope,
    );
  }
}
