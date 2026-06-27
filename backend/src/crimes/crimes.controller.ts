import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CrimesService } from './crimes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueryCrimesDto } from './dto/query-crimes.dto';

// Master tội danh BLHS 2015 — read-only reference, mọi user đã đăng nhập đọc được.
@Controller('crimes')
@UseGuards(JwtAuthGuard)
export class CrimesController {
  constructor(private readonly crimesService: CrimesService) {}

  @Get()
  findAll(@Query() query: QueryCrimesDto) {
    return this.crimesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.crimesService.findOne(id);
  }
}
