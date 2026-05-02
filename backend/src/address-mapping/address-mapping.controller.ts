import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AddressMappingService } from './address-mapping.service';
import { CreateAddressMappingDto } from './dto/create-address-mapping.dto';
import { QueryAddressMappingDto, LookupAddressMappingDto } from './dto/query-address-mapping.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('address-mappings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AddressMappingController {
  constructor(private readonly service: AddressMappingService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Directory' })
  findAll(@Query() query: QueryAddressMappingDto) {
    return this.service.findAll(query);
  }

  @Get('lookup')
  @RequirePermissions({ action: 'read', subject: 'Directory' })
  lookup(@Query() dto: LookupAddressMappingDto) {
    return this.service.lookup(dto);
  }

  @Get('stats')
  @RequirePermissions({ action: 'read', subject: 'Directory' })
  getStats() {
    return this.service.getStats();
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Directory' })
  create(@Body() dto: CreateAddressMappingDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions({ action: 'write', subject: 'Directory' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateAddressMappingDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Directory' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('crawl')
  @RequirePermissions({ action: 'write', subject: 'Directory' })
  crawlAndSync(@Body('province') province?: string) {
    return this.service.crawlAndSync(province ?? 'HCM');
  }
}
