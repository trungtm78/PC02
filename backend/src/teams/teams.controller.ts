import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { TeamsService } from './teams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@Controller('teams')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Team' })
  getList() {
    return this.teamsService.getList();
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Team' })
  getById(@Param('id') id: string) {
    return this.teamsService.getById(id);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Team' })
  create(
    @Body() dto: CreateTeamDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.teamsService.create(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Team' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.teamsService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Team' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.teamsService.delete(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
