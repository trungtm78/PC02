import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OcrJobQueue } from './jobs/ocr-job-queue';
import { OcrJobScheduler, OcrMaintenance } from './jobs/ocr-maintenance';
import { OcrJobRunner } from './jobs/ocr-job-runner';
import { OcrReadExecutor } from './jobs/ocr-read-executor';
import { OcrSessionsService } from './sessions/ocr-sessions.service';
import { ImageStorageService } from './storage/image-storage.service';

@Module({
  imports: [PrismaModule, LlmModule],
  providers: [
    OcrSessionsService,
    ImageStorageService,
    OcrJobQueue,
    OcrReadExecutor,
    OcrJobRunner,
    OcrJobScheduler,
    OcrMaintenance,
  ],
  exports: [OcrSessionsService, ImageStorageService, OcrJobQueue],
})
export class OcrImportModule {}
