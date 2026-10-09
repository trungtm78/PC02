import { Module } from '@nestjs/common';
import { ClockController } from './clock.controller';
import { ReportsController } from './reports.controller';
import { DynamicReportsRegistryService } from './reports.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ClockController, ReportsController],
  providers: [DynamicReportsRegistryService],
})
export class DynamicReportsModule {}
