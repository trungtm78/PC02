import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DirectoryService } from './directory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../auth/decorators/permissions.decorator';
import { CreateDirectoryDto } from './dto/create-directory.dto';
import { QueryDirectoryDto } from './dto/query-directory.dto';
import { QuickCreateDirectoryDto } from './dto/quick-create-directory.dto';

@Controller('directories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get()
  @RequireAnyPermissions(
    { action: 'read', subject: 'Directory' },
    { action: 'read', subject: 'Petition' },
    { action: 'read', subject: 'Incident' },
    { action: 'read', subject: 'Case' },
  )
  findAll(@Query() query: QueryDirectoryDto) {
    return this.directoryService.findAll(query);
  }

  @Get('types')
  @RequirePermissions({ action: 'read', subject: 'Directory' })
  findTypes() {
    return this.directoryService.findTypes();
  }

  @Get('stats')
  @RequirePermissions({ action: 'read', subject: 'Directory' })
  getStats() {
    return this.directoryService.getTypeStats();
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Directory' })
  findOne(@Param('id') id: string) {
    return this.directoryService.findOne(id);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Directory' })
  create(@Body() dto: CreateDirectoryDto) {
    return this.directoryService.create(dto);
  }

  /**
   * Tạo nhanh đơn vị xử lý ngay trên ô tìm của form Đơn thư.
   *
   * Người dùng được tạo nhanh khi có quyền tạo ít nhất một loại hồ sơ sử dụng ô này. Dịch vụ
   * vẫn giới hạn chặt danh sách loại (`LOAI_TAO_NHANH_DUOC`), nên cửa này không mở quyền sửa
   * các danh mục pháp lý hoặc quyền quản trị danh mục.
   */
  @Post('quick')
  @RequireAnyPermissions(
    { action: 'write', subject: 'Petition' },
    { action: 'edit', subject: 'Petition' },
    { action: 'write', subject: 'Incident' },
    { action: 'edit', subject: 'Incident' },
    { action: 'write', subject: 'Case' },
    { action: 'edit', subject: 'Case' },
  )
  taoNhanh(@Body() dto: QuickCreateDirectoryDto) {
    return this.directoryService.taoNhanh(dto);
  }

  @Patch(':id')
  @RequirePermissions({ action: 'write', subject: 'Directory' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateDirectoryDto>) {
    return this.directoryService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Directory' })
  remove(@Param('id') id: string) {
    return this.directoryService.remove(id);
  }

  @Post('seed')
  @RequirePermissions({ action: 'write', subject: 'Directory' })
  seed() {
    return this.directoryService.seedSampleData();
  }
}
