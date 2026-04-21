import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { SubjectsService } from './subjects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { QuerySubjectsDto } from './dto/query-subjects.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
@Controller('subjects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  // GET /api/subjects — Danh sách đối tượng (paginated + filtered)
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Subject' })
  getList(@Query() query: QuerySubjectsDto) {
    return this.subjectsService.getList(query);
  }

  // GET /api/subjects/:id — Chi tiết đối tượng
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Subject' })
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.subjectsService.getById(id, (req as any).dataScope);
  }

  // POST /api/subjects — Tạo đối tượng mới
  @Post()
  @RequirePermissions({ action: 'write', subject: 'Subject' })
  create(
    @Body() dto: CreateSubjectDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.subjectsService.create(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // PUT /api/subjects/:id — Cập nhật đối tượng
  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Subject' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.subjectsService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // DELETE /api/subjects/:id — Xóa đối tượng (soft delete)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Subject' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.subjectsService.delete(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
