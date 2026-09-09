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
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CreateDirectoryDto } from './dto/create-directory.dto';
import { QueryDirectoryDto } from './dto/query-directory.dto';
import { QuickCreateDirectoryDto } from './dto/quick-create-directory.dto';

@Controller('directories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Directory' })
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
   * Quyền `write:Petition` chứ KHÔNG phải `write:Directory`: đo 09/09/2026, chỉ ADMIN có
   * `write:Directory` (OFFICER: 0), nên cán bộ bấm "Tạo mới" sẽ nhận 403 — đúng lớp lỗi
   * "không lưu được đơn thư" từng xảy ra. Đổi lại, dịch vụ tự giới hạn danh sách loại được
   * tạo (`LOAI_TAO_NHANH_DUOC`), nên cửa này không mở ra danh mục pháp lý.
   */
  @Post('quick')
  @RequirePermissions({ action: 'write', subject: 'Petition' })
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
