import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OcrJobQueue } from './jobs/ocr-job-queue';
import { OcrImportController } from './ocr-import.controller';
import { OcrIntakeService } from './ocr-intake.service';
import { OcrJobScheduler, OcrMaintenance } from './jobs/ocr-maintenance';
import { OcrJobRunner } from './jobs/ocr-job-runner';
import { OcrReadExecutor } from './jobs/ocr-read-executor';
import { OcrSessionsService } from './sessions/ocr-sessions.service';
import { ImageStorageService } from './storage/image-storage.service';

@Module({
  imports: [PrismaModule, AuthModule, LlmModule],
  controllers: [OcrImportController],
  providers: [
    OcrSessionsService,
    OcrIntakeService,
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
