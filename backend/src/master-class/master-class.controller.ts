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
import { MasterClassService } from './master-class.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateMasterClassDto } from './dto/create-master-class.dto';
import { UpdateMasterClassDto } from './dto/update-master-class.dto';
import { QueryMasterClassDto } from './dto/query-master-class.dto';

@Controller('master-classes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MasterClassController {
  constructor(private readonly service: MasterClassService) {}

  @Get('types')
  @RequirePermissions({ action: 'read', subject: 'Directory' })
  getTypes() {
    return this.service.getTypes();
  }

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Directory' })
  getList(@Query() query: QueryMasterClassDto) {
    return this.service.getList(query);
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Directory' })
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Directory' })
  create(
    @Body() dto: CreateMasterClassDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.service.create(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Put(':id')
  @RequirePermissions({ action: 'write', subject: 'Directory' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMasterClassDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Directory' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.service.delete(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
