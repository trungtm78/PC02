import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
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

  // ─── Bulk-seed background job (replaces old `crawlAndSync`) ──────────────
  // Endpoint returns immediately with a job ID; the worker fetches data from
  // provinces.open-api.vn in the background. Admin polls /seed/status/:id
  // to track progress, /seed/:id/cancel to abort.

  @Post('seed/:province')
  @HttpCode(HttpStatus.ACCEPTED) // 202: accepted, processing
  @RequirePermissions({ action: 'write', subject: 'Directory' })
  startSeed(@Param('province') province: string, @Req() req: any) {
    const userId = req.user?.id ?? 'unknown';
    return this.service.startSeedJob(province.toUpperCase(), userId);
  }

  @Get('seed/status/:id')
  @RequirePermissions({ action: 'read', subject: 'Directory' })
  seedStatus(@Param('id') id: string) {
    return this.service.getSeedJobStatus(id);
  }

  @Post('seed/:id/cancel')
  @RequirePermissions({ action: 'write', subject: 'Directory' })
  cancelSeed(@Param('id') id: string) {
    return this.service.cancelSeedJob(id);
  }
}
