import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ReportViewsService } from './report-views.service';
import { CreateViewDto, UpdateViewDto } from './dto/view.dto';

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

/** The largest revision a request may name: the nine digits the delete route accepts. */
const MAX_REVISION = 999_999_999;

/**
 * The optional `expectedRevision` of a body that carries nothing else (archive, restore).
 *
 * No body, an empty one, or `expectedRevision: null` = not given. The body is read here and not through a DTO class
 * so that a bad revision is answered with its own code, as on the delete route; like everywhere else, a field the
 * route does not know is refused.
 */
function expectedRevisionOf(body: unknown): number | undefined {
  if (body === undefined || body === null) return undefined;
  const invalid = () => new BadRequestException({ code: 'EXPECTED_REVISION_INVALID' });
  if (typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const { expectedRevision, ...rest } = body as { expectedRevision?: unknown };
  if (Object.keys(rest).length > 0) throw invalid();
  if (expectedRevision === undefined || expectedRevision === null) return undefined;
  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 1 || expectedRevision > MAX_REVISION) {
    throw invalid();
  }
  return expectedRevision;
}

/**
 * The custom reports ("views") saved on a dynamic report.
 *
 * `read:DynamicReport` is only the module's entry gate, as on every route of the aggregate screen; who may really
 * touch a report's views (its managers and the admins) is decided by the service, which answers 404 to anybody else.
 */
@Controller('bao-cao-dong')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class ReportViewsController {
  constructor(private readonly views: ReportViewsService) {}

  @Get('reports/:reportId/views')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  list(
    @Param('reportId') reportId: string,
    @Query('includeArchived') includeArchived: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.views.list(reportId, user, includeArchived === 'true' || includeArchived === '1');
  }

  @Post('reports/:reportId/views')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  create(@Param('reportId') reportId: string, @Body() body: CreateViewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.views.create(reportId, user, body);
  }

  @Patch('views/:id')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  update(@Param('id') id: string, @Body() body: UpdateViewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.views.update(id, user, body);
  }

  /** Body: nothing, or `{ expectedRevision }` to refuse the archiving when the view changed since it was looked at. */
  @Post('views/:id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  archive(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    return this.views.archive(id, user, expectedRevisionOf(body));
  }

  /** The other way of archiving; the same body. */
  @Post('views/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  restore(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    return this.views.restore(id, user, expectedRevisionOf(body));
  }

  /** `expectedRevision` (optional): refuse the delete when the view changed since it was looked at. */
  @Delete('views/:id')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  remove(
    @Param('id') id: string,
    @Query('expectedRevision') expectedRevision: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    let revision: number | undefined;
    if (expectedRevision !== undefined) {
      const text = expectedRevision.trim();
      if (!/^[1-9]\d{0,8}$/.test(text)) throw new BadRequestException({ code: 'EXPECTED_REVISION_INVALID' });
      revision = Number(text);
    }
    return this.views.remove(id, user, revision);
  }
}
