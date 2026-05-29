import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { DispatchGuard } from '../../auth/guards/dispatch.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { BulkAssignPetitionsDto } from '../dto/bulk-assign-petitions.dto';
import { BulkExportPetitionsDto } from '../dto/bulk-export-petitions.dto';
import { PetitionsBulkService } from './petitions.bulk.service';

@Controller('petitions')
export class PetitionsBulkController {
  constructor(private readonly bulkService: PetitionsBulkService) {}

  @Post('bulk-assign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, DispatchGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkAssign(
    @Body() dto: BulkAssignPetitionsDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.bulkService.bulkAssign({
      ids: dto.ids,
      assignedToId: dto.assignedToId,
      reason: dto.reason,
      idempotencyKey: dto.idempotencyKey,
      actorId: user.id,
      dataScope: req.dataScope,
      meta: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    });
  }

  @Post('bulk-export')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkExport(
    @Body() dto: BulkExportPetitionsDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.bulkService.bulkExport({
      ids: dto.ids,
      dataScope: req.dataScope,
      res,
      actorId: user.id,
      meta: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    });
  }
}
