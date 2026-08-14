import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import {
  InvestigationSupplementsService,
  QueryInvestigationSupplementsDto,
} from './investigation-supplements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { UpdateInvestigationSupplementDto } from './dto/update-investigation-supplement.dto';
import { CreateInvestigationSupplementDto } from './dto/create-investigation-supplement.dto';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';

@Controller('investigation-supplements')
@FeatureFlag('investigation-supplements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvestigationSupplementsController {
  constructor(private readonly service: InvestigationSupplementsService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getList(
    @Query() query: QueryInvestigationSupplementsDto,
    @Req() req: ScopedRequest,
  ) {
    return this.service.getList(query, req.dataScope);
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getById(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.service.getById(id, req.dataScope);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(
    @Body() dto: CreateInvestigationSupplementDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.service.create(
      dto,
      user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.dataScope,
    );
  }

  @Patch(':id')
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvestigationSupplementDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.service.update(
      id,
      dto,
      user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.dataScope,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Case' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.service.delete(
      id,
      user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.dataScope,
    );
  }
}
