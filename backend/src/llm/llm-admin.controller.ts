import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../feature-flags/guards/feature-flag.guard';
import {
  CreateProviderDto,
  ListModelsDto,
  SetRoleDto,
  TransferAssessmentDto,
  UpdateProviderDto,
} from './dto/llm.dto';
import { LlmKeyService } from './llm-key.service';
import { LlmProvidersService, type Actor } from './llm-providers.service';

/** Test calls cost money at the provider, so they are throttled harder than ordinary admin writes. */
const TEST_THROTTLE = { default: { ttl: 60000, limit: 5 } };
const WRITE_THROTTLE = { default: { ttl: 60000, limit: 20 } };

const actorOf = (user: AuthUser, req: Request): Actor => ({
  id: user.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

@Controller('llm')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('ocr_import')
export class LlmAdminController {
  constructor(
    private readonly providers: LlmProvidersService,
    private readonly keys: LlmKeyService,
  ) {}

  /** What the admin screen needs first: can the server store keys, and is a transfer assessment in force. */
  @Get('status')
  @RequirePermissions({ action: 'read', subject: 'LlmConfig' })
  async status() {
    const assessment = await this.providers.activeAssessment();
    return { keyConfigured: this.keys.isConfigured(), assessment };
  }

  @Get('providers')
  @RequirePermissions({ action: 'read', subject: 'LlmConfig' })
  list() {
    return this.providers.list();
  }

  @Post('providers')
  @Throttle(WRITE_THROTTLE)
  @RequirePermissions({ action: 'write', subject: 'LlmConfig' })
  create(
    @Body() dto: CreateProviderDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.providers.create(dto, actorOf(user, req));
  }

  @Post('providers/test-draft')
  @HttpCode(HttpStatus.OK)
  @Throttle(TEST_THROTTLE)
  @RequirePermissions({ action: 'write', subject: 'LlmConfig' })
  testDraft(
    @Body() dto: CreateProviderDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.providers.testDraft(dto, actorOf(user, req));
  }

  /** Models offered for unsaved values. POST because the body carries a key, which must never sit in a URL. */
  @Post('providers/list-models')
  @HttpCode(HttpStatus.OK)
  @Throttle(TEST_THROTTLE)
  @RequirePermissions({ action: 'write', subject: 'LlmConfig' })
  listModelsDraft(@Body() dto: ListModelsDto) {
    return this.providers.listModelsDraft(dto);
  }

  @Get('providers/:id/models')
  @Throttle(TEST_THROTTLE)
  @RequirePermissions({ action: 'read', subject: 'LlmConfig' })
  listModels(@Param('id') id: string) {
    return this.providers.listModels(id);
  }

  @Patch('providers/:id')
  @Throttle(WRITE_THROTTLE)
  @RequirePermissions({ action: 'write', subject: 'LlmConfig' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProviderDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.providers.update(id, dto, actorOf(user, req));
  }

  @Post('providers/:id/test')
  @HttpCode(HttpStatus.OK)
  @Throttle(TEST_THROTTLE)
  @RequirePermissions({ action: 'write', subject: 'LlmConfig' })
  test(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.providers.test(id, actorOf(user, req));
  }

  @Post('providers/:id/role')
  @HttpCode(HttpStatus.OK)
  @Throttle(WRITE_THROTTLE)
  @RequirePermissions({ action: 'write', subject: 'LlmConfig' })
  setRole(
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.providers.setRole(id, dto, actorOf(user, req));
  }

  @Post('providers/:id/archive')
  @HttpCode(HttpStatus.OK)
  @Throttle(WRITE_THROTTLE)
  @RequirePermissions({ action: 'write', subject: 'LlmConfig' })
  archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.providers.archive(id, actorOf(user, req));
  }

  @Post('providers/:id/restore')
  @HttpCode(HttpStatus.OK)
  @Throttle(WRITE_THROTTLE)
  @RequirePermissions({ action: 'write', subject: 'LlmConfig' })
  restore(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.providers.restore(id, actorOf(user, req));
  }

  @Delete('providers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(WRITE_THROTTLE)
  @RequirePermissions({ action: 'write', subject: 'LlmConfig' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.providers.remove(id, actorOf(user, req));
  }

  @Post('transfer-assessment')
  @Throttle(WRITE_THROTTLE)
  @RequirePermissions({ action: 'write', subject: 'LlmConfig' })
  createAssessment(
    @Body() dto: TransferAssessmentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.providers.createAssessment(dto, actorOf(user, req));
  }

  @Post('transfer-assessment/withdraw')
  @HttpCode(HttpStatus.OK)
  @Throttle(WRITE_THROTTLE)
  @RequirePermissions({ action: 'write', subject: 'LlmConfig' })
  withdrawAssessment(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.providers.withdrawAssessment(actorOf(user, req));
  }
}
