import { HttpStatus, Injectable } from '@nestjs/common';
import { LlmAdminError } from '../llm/llm-admin-error';
import { LlmProvidersService } from '../llm/llm-providers.service';
import { PrismaService } from '../prisma/prisma.service';
import { OcrImportError } from './ocr-import-error';

/**
 * Who may have scans and their text sent to the configured providers.
 *
 * Asked twice: when a reading is requested, and again when a queued job is about to run. A job can wait in the queue
 * or in retry backoff for a long time, and a permission revoked meanwhile (or a user deactivated) must stop it before
 * anything leaves the system.
 */
@Injectable()
export class OcrSendPolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: LlmProvidersService,
  ) {}

  async assertForRole(roleId: string): Promise<void> {
    const destinations = await this.providers.activeDestinations();
    if (!destinations.cloud && !destinations.internal) {
      throw new LlmAdminError(
        'LLM_NO_PROVIDER',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    // A fail-over sends the same content to the next provider, so every active kind needs permission.
    if (destinations.internal) await this.require(roleId, 'sendInternal');
    if (destinations.cloud) await this.require(roleId, 'sendCloud');
  }

  async assertForUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new OcrImportError('OCR_FORBIDDEN', HttpStatus.FORBIDDEN, {
        action: 'use',
        subject: 'OcrImport',
      });
    }
    await this.assertForRole(user.roleId);
  }

  private async require(roleId: string, action: string): Promise<void> {
    const granted = await this.prisma.rolePermission.count({
      where: { roleId, permission: { action, subject: 'OcrImport' } },
    });
    if (granted === 0) {
      throw new OcrImportError('OCR_FORBIDDEN', HttpStatus.FORBIDDEN, {
        action,
        subject: 'OcrImport',
      });
    }
  }
}
