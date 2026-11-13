import { Controller, Get, HttpCode, HttpStatus, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { attachmentDisposition } from '../attachment-disposition.util';
import { OfficialFileService } from './official-file.service';

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

/**
 * The file a closed period is kept as. `read:DynamicReport` is only the module's door; who may see a period's file is
 * decided by the service (manager, admin, or a viewer of the whole report), which answers "not found" to anyone else.
 */
@Controller('bao-cao-dong')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class OfficialFileController {
  constructor(private readonly files: OfficialFileService) {}

  @Get('periods/:periodId/official-files')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  list(@Param('periodId') periodId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.files.list(periodId, user.id, user.roleId);
  }

  /** "Tạo lại": makes the file again from the closed figures; the one before is kept, marked superseded. */
  @Post('periods/:periodId/official-files')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  regenerate(@Param('periodId') periodId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.files.regenerate(periodId, user.id, user.roleId);
  }

  @Get('official-files/:fileId/download')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async download(@Param('fileId') fileId: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const { fileName, fileBuffer } = await this.files.download(fileId, user.id, user.roleId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', attachmentDisposition(fileName));
    res.send(fileBuffer);
  }
}
