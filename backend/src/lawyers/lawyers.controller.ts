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
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { LawyersService } from './lawyers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateLawyerDto } from './dto/create-lawyer.dto';
import { UpdateLawyerDto } from './dto/update-lawyer.dto';
import { QueryLawyersDto } from './dto/query-lawyers.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
@Controller('lawyers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LawyersController {
  constructor(private readonly lawyersService: LawyersService) {}

  // GET /api/lawyers — Danh sách luật sư (paginated + filtered)
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Lawyer' })
  getList(@Query() query: QueryLawyersDto, @Req() req: ScopedRequest) {
    return this.lawyersService.getList(query, req.dataScope);
  }

  // GET /api/lawyers/:id — Chi tiết luật sư
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Lawyer' })
  getById(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.lawyersService.getById(id, req.dataScope);
  }

  // POST /api/lawyers — Tạo luật sư mới
  @Post()
  @RequirePermissions({ action: 'write', subject: 'Lawyer' })
  create(
    @Body() dto: CreateLawyerDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.lawyersService.create(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // PUT /api/lawyers/:id — Cập nhật luật sư
  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Lawyer' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLawyerDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.lawyersService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // DELETE /api/lawyers/:id — Xóa luật sư (soft delete)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Lawyer' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.lawyersService.delete(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }
}
