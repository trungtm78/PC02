import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import type { ActorContext } from './case-governance.contract';
import { LegalWorkflowService } from './legal-workflow.service';
import type { ActionCreate, ActionVersion } from './legal-workflow.service';
import { CaseConfigurationService } from './case-configuration.service';
import type { ConfigurationVersion } from './case-configuration.service';
import { CaseFieldSchemaService } from './case-field-schema.service';
export function governanceActor(req: ScopedRequest): ActorContext {
  return {
    actorId: (req.user as { id: string } | undefined)?.id ?? '',
    dataScope: req.dataScope,
  };
}
@Controller('cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ action: 'read', subject: 'Case' })
export class CaseLegalWorkflowController {
  constructor(private readonly service: LegalWorkflowService) {}
  @Get('governance/catalog') catalog() {
    return this.service.catalog();
  }
  @Get(':id/actions/capabilities') capabilities(
    @Param('id') id: string,
    @Req() req: ScopedRequest,
    @Query('requestId') requestId?: string,
    @Query('asOf') asOf?: string,
    @Query('inspectionPurpose') inspectionPurpose?: string,
  ) {
    return this.service.actionCapabilities(
      id,
      governanceActor(req),
      requestId,
      asOf,
      inspectionPurpose,
    );
  }
  @Get(':id/actions') list(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.service.list(id, governanceActor(req));
  }
  @Post(':id/actions') create(
    @Param('id') id: string,
    @Body() dto: ActionCreate,
    @Req() req: ScopedRequest,
  ) {
    return this.service.create(id, dto, governanceActor(req));
  }
  @Patch(':id/actions/:requestId') revise(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: ActionVersion & { payload: unknown },
    @Req() req: ScopedRequest,
  ) {
    return this.service.revise(id, requestId, dto, governanceActor(req));
  }
  @Post(':id/actions/:requestId/submit') submit(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: ActionVersion & { reviewerId?: string },
    @Req() req: ScopedRequest,
  ) {
    return this.service.submit(id, requestId, dto, governanceActor(req));
  }
  @Post(':id/actions/:requestId/review') review(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: ActionVersion & { approve: boolean; note: string },
    @Req() req: ScopedRequest,
  ) {
    return this.service.review(id, requestId, dto, governanceActor(req));
  }
  @Post(':id/actions/:requestId/execute') execute(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: ActionVersion,
    @Req() req: ScopedRequest,
  ) {
    return this.service.execute(id, requestId, dto, governanceActor(req));
  }
}
type DraftConfiguration = {
  code: string;
  definition: unknown;
  requestKey: string;
  effectiveFrom?: string;
  effectiveTo?: string;
};
@Controller('cases/governance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ action: 'read', subject: 'Case' })
export class CaseConfigurationController {
  constructor(private readonly service: CaseConfigurationService) {}
  @Get('rules') rules(@Req() req: ScopedRequest) {
    return this.service.list('rules', governanceActor(req));
  }
  @Post('rules') createRule(
    @Body() dto: DraftConfiguration,
    @Req() req: ScopedRequest,
  ) {
    return this.service.create('rules', dto, governanceActor(req));
  }
  @Patch('rules/:id') reviseRule(
    @Param('id') id: string,
    @Body()
    dto: ConfigurationVersion & {
      definition: unknown;
      effectiveFrom?: string;
      effectiveTo?: string;
    },
    @Req() req: ScopedRequest,
  ) {
    return this.service.revise('rules', id, dto, governanceActor(req));
  }
  @Post('rules/:id/validate') validateRule(
    @Param('id') id: string,
    @Body() dto: ConfigurationVersion,
    @Req() req: ScopedRequest,
  ) {
    return this.service.transition(
      'rules',
      id,
      'validate',
      dto,
      governanceActor(req),
    );
  }
  @Post('rules/:id/review') reviewRule(
    @Param('id') id: string,
    @Body() dto: ConfigurationVersion,
    @Req() req: ScopedRequest,
  ) {
    return this.service.transition(
      'rules',
      id,
      'review',
      dto,
      governanceActor(req),
    );
  }
  @Post('rules/:id/publish') publishRule(
    @Param('id') id: string,
    @Body() dto: ConfigurationVersion,
    @Req() req: ScopedRequest,
  ) {
    return this.service.transition(
      'rules',
      id,
      'publish',
      dto,
      governanceActor(req),
    );
  }
  @Get('field-definitions') definitions(@Req() req: ScopedRequest) {
    return this.service.list('fields', governanceActor(req));
  }
  @Post('field-definitions') createFields(
    @Body() dto: DraftConfiguration,
    @Req() req: ScopedRequest,
  ) {
    return this.service.create('fields', dto, governanceActor(req));
  }
  @Patch('field-definitions/:id') reviseFields(
    @Param('id') id: string,
    @Body() dto: ConfigurationVersion & { definition: unknown },
    @Req() req: ScopedRequest,
  ) {
    return this.service.revise('fields', id, dto, governanceActor(req));
  }
  @Post('field-definitions/:id/validate') validateFields(
    @Param('id') id: string,
    @Body() dto: ConfigurationVersion,
    @Req() req: ScopedRequest,
  ) {
    return this.service.transition(
      'fields',
      id,
      'validate',
      dto,
      governanceActor(req),
    );
  }
  @Post('field-definitions/:id/review') reviewFields(
    @Param('id') id: string,
    @Body() dto: ConfigurationVersion,
    @Req() req: ScopedRequest,
  ) {
    return this.service.transition(
      'fields',
      id,
      'review',
      dto,
      governanceActor(req),
    );
  }
  @Post('field-definitions/:id/publish') publishFields(
    @Param('id') id: string,
    @Body() dto: ConfigurationVersion,
    @Req() req: ScopedRequest,
  ) {
    return this.service.transition(
      'fields',
      id,
      'publish',
      dto,
      governanceActor(req),
    );
  }
}
@Controller('cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ action: 'read', subject: 'Case' })
export class CaseFieldSchemaController {
  constructor(private readonly service: CaseFieldSchemaService) {}
  @Get('governance/field-schema') defaultSchema(@Req() req: ScopedRequest) {
    return this.service.get(null, governanceActor(req));
  }
  @Get(':id/governance/field-schema') schema(
    @Param('id') id: string,
    @Req() req: ScopedRequest,
  ) {
    return this.service.get(id, governanceActor(req));
  }
  @Post(':id/governance/field-schema') save(
    @Param('id') id: string,
    @Body()
    dto: {
      requestKey: string;
      expectedUpdatedAt: string;
      fieldDefinitionVersionId?: string;
      values: unknown;
    },
    @Req() req: ScopedRequest,
  ) {
    return this.service.save(id, dto, governanceActor(req));
  }
}
