import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CustomReportService } from './custom-report.service';
import { CustomReportDto } from './dto/view.dto';

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

/**
 * The custom report of one period: what the screen previews, and the Excel file. Both take the same body and are made
 * by the same calculation. The file is taken through the existing download of exports (`GET exports/:id/download`),
 * which checks the caller's standing again.
 *
 * `read:DynamicReport` is the module's entry gate; the service answers 404 to anybody who does not manage the report.
 */
@Controller('bao-cao-dong/periods')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class CustomReportController {
  constructor(private readonly custom: CustomReportService) {}

  @Post(':periodId/custom-preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  preview(@Param('periodId') periodId: string, @Body() body: CustomReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.custom.preview(periodId, user, body);
  }

  @Post(':periodId/custom-export')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  export(@Param('periodId') periodId: string, @Body() body: CustomReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.custom.export(periodId, user, body);
  }
}
