import { Test } from '@nestjs/testing';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { LlmGatewayService } from '../llm/llm-gateway.service';
import { LlmProvidersService } from '../llm/llm-providers.service';
import { OcrIntakeService } from './ocr-intake.service';
import { OcrSendPolicy } from './ocr-send-policy';
import { OcrRereadService } from './ocr-reread.service';
import { OcrQualityService } from './quality/ocr-quality.service';
import { PdfSandbox } from './pdf/pdf-sandbox';
import { OcrFinaliser } from './binding/ocr-finaliser';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { OcrJobQueue } from './jobs/ocr-job-queue';
import { OcrJobRunner } from './jobs/ocr-job-runner';
import { OcrJobScheduler, OcrMaintenance } from './jobs/ocr-maintenance';
import { OcrReadExecutor } from './jobs/ocr-read-executor';
import { OcrSessionsService } from './sessions/ocr-sessions.service';
import { ImageStorageService } from './storage/image-storage.service';

/**
 * Several services here take an optional options object. Nest must still build them when the container offers no
 * provider for it, otherwise the whole application fails to start.
 */
describe('scan intake dependency injection', () => {
  it('builds every provider of the module from its real classes', async () => {
    const module = await Test.createTestingModule({
      providers: [
        OcrSessionsService,
        ImageStorageService,
        OcrJobQueue,
        OcrReadExecutor,
        OcrJobRunner,
        OcrJobScheduler,
        OcrMaintenance,
        OcrIntakeService,
        OcrFinaliser,
        OcrSendPolicy,
        OcrRereadService,
        OcrQualityService,
        PdfSandbox,
        { provide: DocumentsService, useValue: { create: jest.fn() } },
        { provide: LlmProvidersService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: FeatureFlagsService, useValue: { isEnabled: () => false } },
        { provide: LlmGatewayService, useValue: { call: jest.fn() } },
      ],
    }).compile();

    for (const token of [
      OcrSessionsService,
      ImageStorageService,
      OcrJobQueue,
      OcrReadExecutor,
      OcrJobRunner,
      OcrJobScheduler,
      OcrMaintenance,
      OcrRereadService,
    ]) {
      expect(module.get(token)).toBeDefined();
    }
    // The runner is idle while the feature flag is off.
    expect(await module.get(OcrJobRunner).pump()).toBe(0);
  });
});
