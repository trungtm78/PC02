import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { TdacController } from './tdac.controller';
import { TdacService } from './tdac.service';
import { TdacDraftService } from './tdac-draft.service';
import { TdacExportService } from './tdac-export.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TdacController],
  providers: [TdacService, TdacDraftService, TdacExportService],
  exports: [TdacService],
})
export class TdacModule {}
