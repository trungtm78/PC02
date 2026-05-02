import { Module } from '@nestjs/common';
import { PhuLuc16Controller } from './phu-luc-1-6.controller';
import { PhuLuc16Service } from './phu-luc-1-6.service';
import { PhuLuc16ExportService } from './phu-luc-1-6-export.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PhuLuc16Controller],
  providers: [PhuLuc16Service, PhuLuc16ExportService],
  exports: [PhuLuc16Service, PhuLuc16ExportService],
})
export class PhuLuc16Module {}
