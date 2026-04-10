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
